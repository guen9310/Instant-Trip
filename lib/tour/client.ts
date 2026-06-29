import type { TourApiResponse } from "@/lib/tour/types";

const BASE_URL =
  process.env.TOUR_API_BASE_URL ||
  "https://apis.data.go.kr/B551011/KorService2";

if (!process.env.TOUR_API_KEY) {
  throw new Error(
    "TOUR_API_KEY가 없습니다. .env 파일에 키를 입력해주세요.\n" +
      "공공데이터포털 → 마이페이지 → 인증키 관리 → 일반 인증키(Decoding) 복사",
  );
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function maskedUrl(url: string): string {
  return url.replace(/serviceKey=[^&]+/, "serviceKey=***");
}

export function createApiFetch(baseUrl: string) {
  return async function apiFetch<T>(
    endpoint: string,
    params: Record<string, string | number>,
    retryCount = 0,
  ): Promise<TourApiResponse<T>> {
    const API_KEY = process.env.TOUR_API_KEY!;

    const searchParams = new URLSearchParams({
      serviceKey: API_KEY,
      MobileOS: "ETC",
      MobileApp: "Instant-trip",
      _type: "json",
      numOfRows: "10",
      pageNo: "1",
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ),
    });

    const url = `${baseUrl}/${endpoint}?${searchParams}`;
    const safe = maskedUrl(url);
    const attempt = retryCount + 1;

    let httpStatus: number | null = null;
    let rawBody: string | null = null;

    try {
      // Tour API(공공데이터포털)는 TCP 연결 후 무응답 상태가 될 수 있다.
      // 타임아웃 없이 기다리면 파이프라인 전체가 무한 대기에 빠진다.
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      httpStatus = res.status;

      if (!res.ok) {
        rawBody = await res.text().catch(() => "(본문 읽기 실패)");
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const text = await res.text();
      rawBody = text;

      if (text.startsWith("<")) {
        const codeMatch = text.match(
          /<returnReasonCode>(.*?)<\/returnReasonCode>/,
        );
        const msgMatch = text.match(/<returnAuthMsg>(.*?)<\/returnAuthMsg>/);
        throw new Error(
          `API XML 에러: ${codeMatch?.[1] || "unknown"} — ${msgMatch?.[1] || text.slice(0, 200)}`,
        );
      }

      const data = JSON.parse(text) as TourApiResponse<T>;
      const resultCode = data.response?.header?.resultCode;
      if (resultCode !== "0000") {
        throw new Error(
          `API resultCode ${resultCode} — ${data.response?.header?.resultMsg}`,
        );
      }

      return data;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);

      // 상세 에러 로그 (1회만 — 재시도 전에만 출력)
      if (retryCount === 0) {
        console.warn(
          `[ERR] ⚠ ${endpoint} (시도 ${attempt})\n` +
            `  URL    : ${safe}\n` +
            `  HTTP   : ${httpStatus ?? "연결 실패"}\n` +
            `  원인   : ${errMsg}` +
            (rawBody && !rawBody.startsWith('{"response"')
              ? `\n  응답   : ${rawBody.slice(0, 300)}`
              : ""),
        );
        console.warn(`[ERR] 1초 후 재시도...`);
        await sleep(1000);
        return apiFetch(endpoint, params, retryCount + 1);
      }

      // 재시도도 실패 — 최종 에러 로그
      console.error(
        `[ERR] ✗ ${endpoint} 최종 실패 (시도 ${attempt})\n` +
          `  URL    : ${safe}\n` +
          `  HTTP   : ${httpStatus ?? "연결 실패"}\n` +
          `  원인   : ${errMsg}` +
          (rawBody && !rawBody.startsWith('{"response"')
            ? `\n  응답   : ${rawBody.slice(0, 300)}`
            : ""),
      );
      throw err;
    }
  };
}

export const tourFetch = createApiFetch(BASE_URL);

export function extractItems<T>(response: TourApiResponse<T>): T[] {
  const items = response.response?.body?.items;
  if (!items || typeof items === "string") return [];
  if (!Array.isArray(items.item)) return items.item ? [items.item as T] : [];
  return items.item;
}

export async function fetchAllPages<T>(
  endpoint: string,
  params: Record<string, string | number>,
  maxPages = 3,
): Promise<T[]> {
  const results: T[] = [];
  let pageNo = 1;

  while (pageNo <= maxPages) {
    const data = await tourFetch<T>(endpoint, {
      ...params,
      pageNo,
      numOfRows: 100,
    });
    const items = extractItems(data);
    results.push(...items);
    const totalCount = data.response.body.totalCount;
    if (results.length >= totalCount || items.length === 0) break;
    pageNo++;
    await sleep(300);
  }

  return results;
}
