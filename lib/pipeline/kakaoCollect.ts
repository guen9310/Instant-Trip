import type { TourItem } from "@/lib/tour/types";
import { fetchCourseKakao } from "@/lib/clients/kakao-local";
import type { KakaoPlaceTagged } from "@/lib/clients/kakao-local";
import { haversineKm } from "@/shared/utils/geo";

// stage1에서 수집한 TourAPI 원본 후보 수가 이 값 미만일 때만 카카오 보충 발동
// (scale='가볍게' 조건과 AND). 가용성(운영시간) 통과 여부와는 무관 — stage2가
// stage4 이후로 밀려나면서(availabilityGate.ts) 가용 통과분을 미리 알 수 없기 때문.
export const KAKAO_SUPPLEMENT_MIN = 5;

// 중복 판정 거리 임계값 — TourAPI 후보 50m 이내 Kakao 후보는 드롭
const DEDUP_THRESHOLD_KM = 0.05;

// 좌표 그리드 단위: 0.01도 ≈ 1km. 같은 그리드+반경이면 캐시 히트.
const GRID = 0.01;

interface CacheEntry {
  items: TourItem[];
  rawCounts: { at4Category: number; ct1Category: number; parkKeyword: number };
  cachedAt: number;
}

const _cache = new Map<string, CacheEntry>();
const KAKAO_CACHE_TTL = 30 * 60 * 1000; // 30분

function makeCacheKey(lat: number, lng: number, radiusM: number): string {
  return `${Math.round(lat / GRID)}_${Math.round(lng / GRID)}_${radiusM}`;
}

function normalizeKakaoPlace(place: KakaoPlaceTagged): TourItem {
  // 공원류만 수집하므로 contenttypeid는 항상 "12" (관광지)
  const contenttypeid = "12";

  return {
    contentid: `kakao_${place.id}`,
    contenttypeid,
    title: place.place_name,
    addr1: place.address_name,
    addr2: "",
    mapx: place.x,
    mapy: place.y,
    firstimage: "",
    firstimage2: "",
    areacode: "",
    sigungucode: "",
    createdtime: "",
    modifiedtime: "",
    tel: place.phone ?? "",
    source: "kakao",
    kakaoCategory: place.kakaoCategory,
    placeUrl: place.place_url,
    // lclsSystm은 위조하지 않는다 — 태그/체류시간은 kakaoCategory로만 부여
  };
}

// 검증 스크립트용 — 카카오 후보만 단독 수집
export async function collectKakaoCandidates(
  lat: number,
  lng: number,
  radiusM: number,
): Promise<TourItem[]> {
  console.log(`[kakao] 카카오 코스 후보 수집 시작 — 위치 (${lat}, ${lng}), 반경 ${radiusM}m`);
  const t0 = Date.now();

  const { items: places, rawCounts } = await fetchCourseKakao(lat, lng, radiusM);
  const items = places.map(normalizeKakaoPlace);

  console.log(
    `[kakao] 수집 완료 — 공원:${rawCounts.parkKeyword}건 (${Date.now() - t0}ms)`,
  );

  return items;
}

// 파이프라인 배선용 — stage1 원본 TourAPI 후보(가용성 검사 이전)에 카카오 후보를 보충
// 두 조건 모두 충족 시 발동: scale='가볍게' AND tourPool.length < KAKAO_SUPPLEMENT_MIN
export async function supplementWithKakao(
  tourPool: TourItem[],
  lat: number,
  lng: number,
  radiusM: number,
): Promise<TourItem[]> {
  const key = makeCacheKey(lat, lng, radiusM);
  let kakaoItems: TourItem[];
  let rawCounts: { at4Category: number; ct1Category: number; parkKeyword: number };

  const cached = _cache.get(key);
  if (cached && Date.now() - cached.cachedAt < KAKAO_CACHE_TTL) {
    kakaoItems = cached.items;
    rawCounts = cached.rawCounts;
    console.log(`[보충] 캐시 hit — 카카오 후보 ${kakaoItems.length}건`);
  } else {
    const result = await fetchCourseKakao(lat, lng, radiusM);
    kakaoItems = result.items.map(normalizeKakaoPlace);
    rawCounts = result.rawCounts;
    _cache.set(key, { items: kakaoItems, rawCounts, cachedAt: Date.now() });
  }

  // 중복 제거: TourAPI 후보 50m 이내 Kakao 후보 드롭 (좌표만 비교, 이름 무관)
  const dedupedKakao = kakaoItems.filter((kakao) => {
    const kLat = parseFloat(kakao.mapy);
    const kLng = parseFloat(kakao.mapx);
    if (isNaN(kLat) || isNaN(kLng)) return false;

    for (const tour of tourPool) {
      const tLat = parseFloat(tour.mapy);
      const tLng = parseFloat(tour.mapx);
      if (isNaN(tLat) || isNaN(tLng)) continue;
      if (haversineKm(kLat, kLng, tLat, tLng) < DEDUP_THRESHOLD_KM) return false;
    }
    return true;
  });

  // 좌표 중복(tour-vs-kakao 50m 기준)
  const coordDupCount = kakaoItems.length - dedupedKakao.length;

  const parkFinal = dedupedKakao.length;

  console.log(
    `[보충] 발동 (수집 ${tourPool.length}<${KAKAO_SUPPLEMENT_MIN})` +
    ` → 공원키워드 ${rawCounts.parkKeyword}건,` +
    ` 좌표중복 ${coordDupCount}건 제거,` +
    ` 최종 tour:${tourPool.length}/공원:${parkFinal}`,
  );

  return [...tourPool, ...dedupedKakao];
}
