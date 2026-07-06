import { tourFetch, extractItems } from "@/lib/tour/client";
import { readCache, writeCache } from "@/lib/tour/cache";
import { ENDPOINTS } from "@/lib/tour/endpoints";
import type { TourItem } from "@/lib/tour/types";
import type { UserProfile } from "@/lib/pipeline/types";
import { getSearchRadiusM } from "@/lib/pipeline/types";

// 같은 위치+반경+타입 조합의 결과를 1시간 동안 재사용한다.
// API 호출 횟수를 줄이기 위함이며, 1시간 이내 같은 요청이 들어오면 캐시에서 즉시 반환한다.
const STAGE1_TTL = 60 * 60 * 1000; // 1시간

const TYPE_LABEL: Record<string, string> = {
  "12": "관광지", "14": "문화시설", "15": "행사",
  "28": "레포츠", "38": "쇼핑",    "39": "음식점",
};

// 수집 대상 콘텐츠 타입 목록.
// 숙박(32), 쇼핑(38), 여행코스(25)는 코스 구성에 불필요해서 제외했다.
// 음식점(39): 주변 정보(/api/nearby)에서 별도 제공
// 행사(15): 관광공사 DB에 과거 데이터가 잔존해 신뢰도 낮음 — 제외
const TARGET_CONTENT_TYPES = ["12", "14", "28"];

// [stage1] 사용자 현재 위치 반경 내 장소를 수집한다.
//
// - 여행 규모(scale)에 따라 반경이 달라진다: 가볍게=5km, 적당히=10km, 여유롭게=20km
// - 3개 콘텐츠 타입(12/14/28)을 Promise.all로 동시에 호출해서 병렬로 가져온다.
// - 각 타입당 최대 40건씩 수집하므로 합산 최대 120건이 된다.
// - 여러 타입에 중복 등록된 장소가 있을 수 있어서, contentid 기준으로 중복을 제거한다.
// - 반환값: 중복 제거된 TourItem 배열 (이후 stage2로 전달됨)
export async function collectCandidates(profile: UserProfile): Promise<TourItem[]> {
  const radius = getSearchRadiusM(profile);
  const { mapX, mapY } = profile.location;

  console.log(`[stage1] 반경 ${(radius/1000).toFixed(0)}km · 위치 (${mapY}, ${mapX})`);
  console.log(`[stage1] 수집 타입: ${TARGET_CONTENT_TYPES.map(t => TYPE_LABEL[t]).join(", ")}`);

  const results: TourItem[] = [];
  const t0 = Date.now();

  // 타입별로 동시에 요청한다.
  // 순서대로 기다리면 배 느려지므로 Promise.all로 병렬 처리한다.
  const fetches = TARGET_CONTENT_TYPES.map(async (contentTypeId) => {
    const label = TYPE_LABEL[contentTypeId];

    // 캐시 키: 위치(소수점 2자리)+ 반경 + 타입으로 조합한다.
    // 같은 위치에서 같은 타입을 요청하면 캐시를 히트한다.
    const cacheKey = `stage1_${Math.round(mapX * 100)}_${Math.round(mapY * 100)}_${radius}_${contentTypeId}`;
    const cached = readCache<TourItem[]>(cacheKey, STAGE1_TTL);
    if (cached) {
      console.log(`[stage1] ${label}(${contentTypeId}) → 캐시 hit (${cached.length}건)`);
      return cached;
    }

    const ts = Date.now();
    try {
      // arrange=E: 거리순 정렬. 사용자 위치에서 가까운 장소가 앞에 온다.
      const data = await tourFetch<TourItem>(ENDPOINTS.LOCATION_BASED_LIST, {
        mapX, mapY, radius, contentTypeId, numOfRows: 40, arrange: "E",
      });
      const items = extractItems(data);
      const total = data.response.body.totalCount;
      console.log(`[stage1] ${label}(${contentTypeId}) → ${items.length}건 수집 / 전체 ${total}건 (${Date.now() - ts}ms)`);
      writeCache(cacheKey, items);
      return items;
    } catch (err) {
      // 특정 타입 수집 실패 시 해당 타입만 빈 배열로 처리하고 나머지는 계속 진행한다.
      console.warn(`[stage1] ${label}(${contentTypeId}) 수집 실패 (${Date.now() - ts}ms) — ${err}`);
      return [] as TourItem[];
    }
  });

  const settled = await Promise.all(fetches);
  for (const items of settled) results.push(...items);

  // 같은 장소가 여러 타입에 걸쳐 중복 수집될 수 있다 (예: 복합 문화공간이 관광지+문화시설에 동시 등록).
  // contentid는 장소의 고유 ID이므로 이를 기준으로 중복을 제거한다.
  const seen = new Set<string>();
  const deduped = results.filter((item) => {
    if (seen.has(item.contentid)) return false;
    seen.add(item.contentid);
    return true;
  });

  const dupeCount = results.length - deduped.length;
  console.log(`[stage1] 완료 — 총 ${results.length}건 → 중복 ${dupeCount}건 제거 → ${deduped.length}건 (총 ${Date.now() - t0}ms)`);

  // lclsSystm 기반 부적합 카테고리 제외:
  // - AC (숙박): AC05(캠핑)만 허용, 나머지 숙박은 당일 코스 불적합
  // - SH (쇼핑): 코스 구성 목적과 맞지 않음
  // - FD (음식): 별도 식당 추천 경로로 처리
  const filtered = deduped.filter((item) => !isExcludedByCategory(item));
  const excludedCount = deduped.length - filtered.length;
  if (excludedCount > 0) {
    console.log(`[stage1] 카테고리 제외 ${excludedCount}건 (숙박/쇼핑/음식) → ${filtered.length}건`);
  }

  for (const item of filtered) {
    item.source = "tour";
  }

  return filtered;
}

function isExcludedByCategory(item: TourItem): boolean {
  const s1 = item.lclsSystm1;
  const s2 = item.lclsSystm2;
  if (s1 === "AC" && s2 !== "AC05") return true; // 숙박 (캠핑 AC05만 허용)
  if (s1 === "SH") return true;                   // 쇼핑
  if (s1 === "FD") return true;                   // 음식
  return false;
}
