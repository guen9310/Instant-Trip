import type {
  UserProfile,
  CourseResult,
  PipelineResult,
  PlaceWithTags,
  RecommendedFood,
} from "@/lib/pipeline/types";
import { SCALE_CONFIG } from "@/lib/pipeline/types";
import { collectCandidates } from "@/lib/pipeline/collect";
import { filterByAvailability } from "@/lib/pipeline/availability";
import type { TourItem } from "@/lib/tour/types";
import {
  scoreCandidates,
  applyMappingRules,
  haversineKm,
} from "@/lib/pipeline/scoring";
import { assembleCourse, fetchFestivalImage } from "@/lib/pipeline/course";
import {
  supplementWithKakao,
  KAKAO_SUPPLEMENT_MIN,
} from "@/lib/pipeline/kakaoCollect";
import { fetchCulturalFestivals } from "@/lib/clients/cultural-festival";
import type { CulturalFestival } from "@/lib/clients/cultural-festival";
import { fetchNearby } from "@/lib/clients/kakao-local";

export type {
  UserProfile,
  CourseResult,
  PipelineResult,
  TravelScale,
  TagKey,
  TagWeights,
  OnboardingAnswers,
} from "@/lib/pipeline/types";
export { onboardingToProfile, applyFeedback } from "@/lib/pipeline/types";

function elapsed(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// 원본 데이터를 1시간 메모리 캐시 — 파이프라인마다 API를 재호출하지 않는다
let _festivalCache: { data: CulturalFestival[]; cachedAt: number } | null =
  null;
const FESTIVAL_CACHE_TTL = 60 * 60 * 1000; // 1시간

async function getAllFestivals(): Promise<CulturalFestival[]> {
  if (
    _festivalCache &&
    Date.now() - _festivalCache.cachedAt < FESTIVAL_CACHE_TTL
  ) {
    return _festivalCache.data;
  }
  const data = await fetchCulturalFestivals();
  _festivalCache = { data, cachedAt: Date.now() };
  return data;
}

async function fetchNearbyFestivals(
  lat: number,
  lng: number,
  radiusKm: number,
  options: { simulationDate?: string; affinity?: number } = {},
): Promise<{ ongoing: CulturalFestival[]; upcoming: CulturalFestival[] }> {
  try {
    const all = await getAllFestivals();
    const base = options.simulationDate
      ? new Date(options.simulationDate)
      : new Date();
    const today = base.toISOString().slice(0, 10);
    const oneMonthLater = new Date(base);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
    const limitDate = oneMonthLater.toISOString().slice(0, 10);

    const distKm = (f: CulturalFestival) =>
      haversineKm(lat, lng, f.latitude, f.longitude);
    const inRadius = (f: CulturalFestival) => {
      if (isNaN(f.latitude) || isNaN(f.longitude)) return false;
      return distKm(f) <= radiusKm;
    };

    const ongoing = all.filter(
      (f) =>
        f.fstvlStartDate <= today && f.fstvlEndDate >= today && inRadius(f),
    );
    const upcoming = all.filter(
      (f) =>
        f.fstvlStartDate > today &&
        f.fstvlStartDate <= limitDate &&
        inRadius(f),
    );

    // 실외 친화(affinity >= 0.6)면 거리순, 그 외엔 시작일순
    const affinity = options.affinity ?? 0;
    const sort = (list: CulturalFestival[]) =>
      affinity >= 0.6
        ? [...list].sort((a, b) => distKm(a) - distKm(b))
        : [...list].sort((a, b) =>
            a.fstvlStartDate.localeCompare(b.fstvlStartDate),
          );

    return { ongoing: sort(ongoing), upcoming: sort(upcoming) };
  } catch (err) {
    console.warn(`[pipeline] 문화축제 조회 실패 — ${err}`);
    return { ongoing: [], upcoming: [] };
  }
}

export async function generateCourse(
  profile: UserProfile,
  options: { simulationDate?: string; excludeIds?: string[] } = {},
): Promise<PipelineResult> {
  const t0 = Date.now();
  console.log(
    `[pipeline] ▶ 시작 — 규모: ${profile.scale} | 위치: (${profile.location.mapY}, ${profile.location.mapX})`,
  );
  console.log(`[pipeline] 온보딩 태그: ${JSON.stringify(profile.tagWeights)}`);

  // stage1: Tour API 직접 호출 (매 요청마다)
  let ts = Date.now();
  const radiusKm = SCALE_CONFIG[profile.scale].radius / 1000;
  const { mapY: lat, mapX: lng } = profile.location;

  // 축제 조회를 파이프라인과 병렬로 미리 시작 (캐시 없으면 ~10s 소요되므로)
  const festivalPromise = fetchNearbyFestivals(lat, lng, radiusKm, {
    simulationDate: options.simulationDate,
    affinity: profile.festivalAffinity,
  });

  const items = await collectCandidates(profile);
  console.log(
    `[pipeline] stage1 수집 ${items.length}건 | ${elapsed(Date.now() - ts)}`,
  );

  if (items.length === 0) {
    console.log(`[pipeline] 후보지 없음 — 종료`);
    const empty: CourseResult = {
      mainPlace: null,
      nearbyPlaces: [],
      festivals: [],
      recommended_food: null,
      scale: profile.scale,
      generatedAt: new Date().toISOString(),
    };
    return {
      course: empty,
      debug: { collected: [], available: [], scored: [] },
    };
  }

  ts = Date.now();
  const placesWithTags: PlaceWithTags[] = items.map((item) => ({
    ...item,
    tagScores: applyMappingRules(item),
  }));
  console.log(
    `[pipeline] stage1 완료 — ${placesWithTags.length}건 | ${elapsed(Date.now() - ts)}`,
  );

  if (placesWithTags.length === 0) {
    console.log(`[pipeline] 후보지 없음 — 종료`);
    const empty: CourseResult = {
      mainPlace: null,
      nearbyPlaces: [],
      festivals: [],
      recommended_food: null,
      scale: profile.scale,
      generatedAt: new Date().toISOString(),
    };
    return {
      course: empty,
      debug: { collected: [], available: [], scored: [] },
    };
  }

  // stage2: 현재 운영 중인 장소만 통과
  ts = Date.now();
  const available = await filterByAvailability(placesWithTags);
  console.log(
    `[pipeline] stage2 완료 — ${available.length}/${placesWithTags.length}건 통과 | ${elapsed(Date.now() - ts)}`,
  );

  // stage3.5: 가볍게 + 가용 후보 부족 시 카카오 후보 보충
  // supplementWithKakao는 TourItem[]을 반환하므로 TourItem[]으로 받고, 이후 맵에서 availabilityUncertain를 복원
  let availablePool: TourItem[] = available;
  if (profile.scale === "가볍게" && available.length < KAKAO_SUPPLEMENT_MIN) {
    try {
      ts = Date.now();
      availablePool = await supplementWithKakao(
        available,
        lat,
        lng,
        SCALE_CONFIG[profile.scale].radius,
      );
      console.log(
        `[pipeline] stage3.5 보충 완료 — ${available.length} → ${availablePool.length}건 | ${elapsed(Date.now() - ts)}`,
      );
    } catch (err) {
      console.warn(`[pipeline] stage3.5 카카오 보충 실패, 기존 후보 유지 — ${err}`);
    }
  } else if (profile.scale === "가볍게") {
    console.log(
      `[pipeline] stage3.5 보충 스킵 — 가용 ${available.length}건 ≥ ${KAKAO_SUPPLEMENT_MIN}`,
    );
  }

  // source 분포 로깅
  const tourCount = availablePool.filter((i) => i.source !== "kakao").length;
  const kakaoCount = availablePool.filter((i) => i.source === "kakao").length;
  if (kakaoCount > 0) {
    console.log(`[pipeline] 후보 source 분포 — tour:${tourCount} / kakao:${kakaoCount}`);
  }

  // stage4: tagScores는 이미 placesWithTags에 부착되어 있으므로 그대로 재부착
  // excludeIds에 포함된 장소는 후보에서 제외한다 (거절 재추천용)
  const excludeSet = new Set(options.excludeIds ?? []);
  const availableWithTags: PlaceWithTags[] = availablePool
    .filter((item) => !excludeSet.has(item.contentid))
    .map((item) => ({
      ...item,
      // Kakao 보충 아이템은 tagScores가 없으므로 항상 applyMappingRules 적용
      tagScores: (item as PlaceWithTags).tagScores ?? applyMappingRules(item),
      // filterByAvailability가 부착한 플래그; 카카오 보충 아이템엔 없으므로 false 기본값
      availabilityUncertain: (item as PlaceWithTags).availabilityUncertain ?? false,
    }));
  if (excludeSet.size > 0) {
    console.log(
      `[pipeline] excludeIds ${excludeSet.size}건 제외 — ${available.length} → ${availableWithTags.length}건`,
    );
  }

  ts = Date.now();
  const scored = await scoreCandidates(availableWithTags, profile);
  console.log(
    `[pipeline] stage4 완료 — ${scored.length}건 점수화 | ${elapsed(Date.now() - ts)}`,
  );

  const allCandidates = [...scored];

  // stage5: 최종 코스 조립
  ts = Date.now();
  const courseBase = await assembleCourse(allCandidates, profile);
  console.log(
    `[pipeline] stage5 완료 — 메인 ${courseBase.mainPlace ? 1 : 0}곳 + 연계 ${courseBase.nearbyPlaces.length}곳 | ${elapsed(Date.now() - ts)}`,
  );

  ts = Date.now();
  const { ongoing: festivalsOngoing } = await festivalPromise;
  console.log(
    `[pipeline] 문화축제 — 진행중 ${festivalsOngoing.length}건 | ${elapsed(Date.now() - ts)}`,
  );

  // festivalAffinity >= 0.6(실외 선호)이면 가장 가까운 축제 이미지를 미리 로드해둔다.
  // festivals 필드로 반환되며 코스 장소와는 분리된다.
  if (profile.festivalAffinity >= 0.6 && festivalsOngoing.length > 0) {
    const nearest = festivalsOngoing[0];
    const festivalImages = await fetchFestivalImage(nearest.fstvlNm);
    // festivalsOngoing[0]에 이미지를 덮어써서 클라이언트가 바로 사용할 수 있게 한다.
    (nearest as CulturalFestival & { images?: string[] }).images =
      festivalImages;
    console.log(
      `[pipeline] 축제 이미지 로드 — "${nearest.fstvlNm}" (${festivalImages.length}장)`,
    );
  }

  // preferFood=true이면 출발지 1km 이내 가장 가까운 음식점 1곳을 추천한다.
  // 코스 장소로 포함하지 않고 별도 필드로 반환 — 동선 최적화 대상 밖.
  let recommended_food: RecommendedFood | null = null;
  if (profile.preferFood) {
    try {
      const nearby = await fetchNearby(lat, lng, "FD6", 1000);
      if (nearby.length > 0) {
        const p = nearby[0]; // fetchNearby는 거리순 정렬 반환
        recommended_food = {
          name: p.place_name,
          category: p.category_name,
          address: p.road_address_name || p.address_name,
          phone: p.phone,
          distanceM: parseInt(p.distance),
          url: p.place_url,
          coord: { lat: parseFloat(p.y), lng: parseFloat(p.x) },
        };
        console.log(
          `[pipeline] 식당 추천 — "${p.place_name}" (${p.distance}m)`,
        );
      } else {
        console.log(`[pipeline] 식당 추천 — 1km 이내 음식점 없음`);
      }
    } catch (err) {
      console.warn(
        `[pipeline] 식당 추천 실패 (KAKAO_REST_KEY 미설정 또는 API 오류) — ${err}`,
      );
    }
  }

  const course: CourseResult = {
    ...courseBase,
    festivals: festivalsOngoing,
    recommended_food,
  };

  const courseIds = new Set([
    ...(course.mainPlace ? [course.mainPlace.contentId] : []),
    ...course.nearbyPlaces.map((p) => p.contentId),
  ]);
  const scoredWithCourse = allCandidates.map((c) => ({
    ...c,
    inCourse: courseIds.has(c.item.contentid),
  }));

  const total = Date.now() - t0;
  console.log(`[pipeline] ■ 전체 완료 — 총 소요: ${elapsed(total)}`);

  return {
    course,
    debug: { collected: availablePool, available: availablePool, scored: scoredWithCourse },
  };
}
