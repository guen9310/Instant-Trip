import { db } from "@/server/db";
import { apiCache } from "@/server/schema";
import { eq } from "drizzle-orm";

// 캐시 미스(null)와 구분되는 "API 호출 완료, 데이터 없음" 상태 표시자.
// Symbol이라 JSON 직렬화 불가 → DB에는 저장하지 않고, getCached 반환값에만 사용.
export const CACHE_EMPTY = Symbol("CACHE_EMPTY");
export type CacheEmpty = typeof CACHE_EMPTY;

// DB에 저장되는 "빈 응답" 마커. getCached에서 이 값을 읽으면 CACHE_EMPTY를 반환.
const EMPTY_PAYLOAD = { __empty: true } as const;

function isEmptyPayload(val: unknown): boolean {
  return (
    typeof val === "object" &&
    val !== null &&
    (val as Record<string, unknown>).__empty === true
  );
}

// 반환값 세 가지:
//   T            — 캐시 히트, 실제 데이터
//   CACHE_EMPTY  — 캐시 히트, 이전 API 호출 결과가 빈 응답이었음
//   null         — 캐시 미스 (행 없음, 만료, DB 오류)
export async function getCached<T>(key: string): Promise<T | CacheEmpty | null> {
  try {
    const rows = await db
      .select()
      .from(apiCache)
      .where(eq(apiCache.cacheKey, key))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    if (row.expiresAt < new Date()) return null;
    if (isEmptyPayload(row.payload)) return CACHE_EMPTY;

    return row.payload as T;
  } catch (err) {
    console.warn(`[dbCache] read "${key}" 실패 — ${err}`);
    return null;
  }
}

// SWR(stale-while-revalidate)용 읽기 결과.
//   fresh — 만료 전, 그대로 사용 가능
//   stale — 만료됐지만 행은 존재함 (호출부가 즉시 서빙하고 백그라운드 갱신을 트리거하는 용도)
//   miss  — 행 자체가 없음 (최초 수집 필요)
// value는 stale일 때도 채워진다 — stale 서빙의 원료이므로 만료 행을 여기서 지우지 않는다.
export type CacheSWRResult<T> =
  | { freshness: "fresh" | "stale"; value: T | CacheEmpty }
  | { freshness: "miss"; value: null };

export async function getCachedSWR<T>(key: string): Promise<CacheSWRResult<T>> {
  try {
    const rows = await db
      .select()
      .from(apiCache)
      .where(eq(apiCache.cacheKey, key))
      .limit(1);

    const row = rows[0];
    if (!row) return { freshness: "miss", value: null };

    const value = isEmptyPayload(row.payload) ? CACHE_EMPTY : (row.payload as T);
    const freshness = row.expiresAt < new Date() ? "stale" : "fresh";
    return { freshness, value };
  } catch (err) {
    console.warn(`[dbCache] SWR read "${key}" 실패 — ${err}`);
    return { freshness: "miss", value: null };
  }
}

export async function setCached(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await db
      .insert(apiCache)
      .values({ cacheKey: key, payload: value, expiresAt })
      .onConflictDoUpdate({
        target: apiCache.cacheKey,
        set: { payload: value, expiresAt },
      });
  } catch (err) {
    console.warn(`[dbCache] write "${key}" 실패 — ${err}`);
  }
}

// API 호출 결과가 빈 응답일 때 EMPTY_PAYLOAD를 저장한다.
// 다음 읽기에서 CACHE_EMPTY를 반환하여 불필요한 재호출을 막는다.
export async function setCachedEmpty(
  key: string,
  ttlSeconds: number,
): Promise<void> {
  return setCached(key, EMPTY_PAYLOAD, ttlSeconds);
}
