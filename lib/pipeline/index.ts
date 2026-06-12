import type { UserProfile, CourseResult, PipelineResult, PlaceWithTags, RecommendedFood } from "@/lib/pipeline/types";
import { SCALE_CONFIG } from "@/lib/pipeline/types";
import { collectCandidates } from "@/lib/pipeline/stage1-collect";
import { filterByAvailability } from "@/lib/pipeline/stage2-availability";
import { scoreCandidates, applyMappingRules, haversineKm } from "@/lib/pipeline/stage4-scoring";
import { assembleCourse, fetchFestivalImage } from "@/lib/pipeline/stage5-course";
import { placeStore, getAreaKey } from "@/lib/db/store";
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
let _festivalCache: { data: CulturalFestival[]; cachedAt: number } | null = null;
const FESTIVAL_CACHE_TTL = 60 * 60 * 1000; // 1시간

async function getAllFestivals(): Promise<CulturalFestival[]> {
  if (_festivalCache && Date.now() - _festivalCache.cachedAt < FESTIVAL_CACHE_TTL) {
    return _festivalCache.data;
  }
  const data = await fetchCulturalFestivals();
  _festivalCache = { data, cachedAt: Date.now() };
  return data;
}

async function fetchNearbyFestivals(
  lat: number, lng: number, radiusKm: number,
  options: { simulationDate?: string; affinity?: number } = {},
): Promise<{ ongoing: CulturalFestival[]; upcoming: CulturalFestival[] }> {
  try {
    const all = await getAllFestivals();
    const base = options.simulationDate ? new Date(options.simulationDate) : new Date();
    const today = base.toISOString().slice(0, 10);
    const oneMonthLater = new Date(base);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
    const limitDate = oneMonthLater.toISOString().slice(0, 10);

    const distKm = (f: CulturalFestival) => haversineKm(lat, lng, f.latitude, f.longitude);
    const inRadius = (f: CulturalFestival) => {
      if (isNaN(f.latitude) || isNaN(f.longitude)) return false;
      return distKm(f) <= radiusKm;
    };

    const ongoing  = all.filter(f => f.fstvlStartDate <= today && f.fstvlEndDate >= today && inRadius(f));
    const upcoming = all.filter(f => f.fstvlStartDate > today && f.fstvlStartDate <= limitDate && inRadius(f));

    // 실외 친화(affinity >= 0.6)면 거리순, 그 외엔 시작일순
    const affinity = options.affinity ?? 0;
    const sort = (list: CulturalFestival[]) =>
      affinity >= 0.6
        ? [...list].sort((a, b) => distKm(a) - distKm(b))
        : [...list].sort((a, b) => a.fstvlStartDate.localeCompare(b.fstvlStartDate));

    return { ongoing: sort(ongoing), upcoming: sort(upcoming) };
  } catch (err) {
    console.warn(`[pipeline] 문화축제 조회 실패 — ${err}`);
    return { ongoing: [], upcoming: [] };
  }
}

export async function generateCourse(
  profile: UserProfile,
  options: { simulationDate?: string } = {},
): Promise<PipelineResult> {
  const t0 = Date.now();
  console.log(
    `[pipeline] ▶ 시작 — 규모: ${profile.scale} | 위치: (${profile.location.mapY}, ${profile.location.mapX})`,
  );
  console.log(`[pipeline] 온보딩 태그: ${JSON.stringify(profile.tagWeights)}`);

  // stage1: DB 캐시 확인 → 미스 시 Tour API 호출 후 적재
  let ts = Date.now();
  const radiusKm = SCALE_CONFIG[profile.scale].radius / 1000;
  const { mapY: lat, mapX: lng } = profile.location;

  // 축제 조회를 파이프라인과 병렬로 미리 시작 (캐시 없으면 ~10s 소요되므로)
  const festivalPromise = fetchNearbyFestivals(lat, lng, radiusKm, {
    simulationDate: options.simulationDate,
    affinity: profile.festivalAffinity,
  });
  const areaKey = getAreaKey(lat, lng, radiusKm);

  let placesWithTags: PlaceWithTags[];

  if (!placeStore.isCacheValid(areaKey)) {
    console.log(`[pipeline] stage1 DB 캐시 미스 (${areaKey}) — Tour API 호출`);
    const items = await collectCandidates(profile);
    console.log(`[pipeline] stage1 수집 ${items.length}건 | ${elapsed(Date.now() - ts)}`);

    if (items.length === 0) {
      console.log(`[pipeline] 후보지 없음 — 종료`);
      const empty: CourseResult = {
        mainPlace: null, nearbyPlaces: [], festivals: [], recommended_food: null,
        scale: profile.scale, generatedAt: new Date().toISOString(),
      };
      return { course: empty, debug: { collected: [], available: [], scored: [] } };
    }

    ts = Date.now();
    placeStore.upsertPlaces(areaKey, items);
    const dbStats = placeStore.stats();
    console.log(
      `[pipeline] stage1 DB 적재 완료 — 장소 ${dbStats.places}건 / 태그 ${dbStats.tags}건 | ${elapsed(Date.now() - ts)}`,
    );
  } else {
    console.log(`[pipeline] stage1 DB 캐시 히트 (${areaKey}) — Tour API 스킵`);
  }

  ts = Date.now();
  placesWithTags = placeStore.queryPlacesWithTags(lat, lng, radiusKm);
  console.log(`[pipeline] stage1 완료 — ${placesWithTags.length}건 | ${elapsed(Date.now() - ts)}`);

  if (placesWithTags.length === 0) {
    console.log(`[pipeline] 후보지 없음 — 종료`);
    const empty: CourseResult = {
      mainPlace: null, nearbyPlaces: [], festivals: [], recommended_food: null,
      scale: profile.scale, generatedAt: new Date().toISOString(),
    };
    return { course: empty, debug: { collected: [], available: [], scored: [] } };
  }

  // PlaceWithTags는 TourItem을 확장하므로 stage2/3에 그대로 전달 가능
  const tagScoreMap = new Map(placesWithTags.map((p) => [p.contentid, p.tagScores]));

  // stage2: 현재 운영 중인 장소만 통과
  ts = Date.now();
  const available = await filterByAvailability(placesWithTags);
  console.log(
    `[pipeline] stage2 완료 — ${available.length}/${placesWithTags.length}건 통과 | ${elapsed(Date.now() - ts)}`,
  );

  // stage4: DB에서 읽어온 tagScores를 재부착 후 점수화
  const availableWithTags: PlaceWithTags[] = available.map((item) => ({
    ...item,
    tagScores: tagScoreMap.get(item.contentid) ?? applyMappingRules(item),
  }));

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
    (nearest as CulturalFestival & { images?: string[] }).images = festivalImages;
    console.log(`[pipeline] 축제 이미지 로드 — "${nearest.fstvlNm}" (${festivalImages.length}장)`);
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
          name:      p.place_name,
          category:  p.category_name,
          address:   p.road_address_name || p.address_name,
          phone:     p.phone,
          distanceM: parseInt(p.distance),
          url:       p.place_url,
          coord:     { lat: parseFloat(p.y), lng: parseFloat(p.x) },
        };
        console.log(`[pipeline] 식당 추천 — "${p.place_name}" (${p.distance}m)`);
      } else {
        console.log(`[pipeline] 식당 추천 — 1km 이내 음식점 없음`);
      }
    } catch (err) {
      console.warn(`[pipeline] 식당 추천 실패 (KAKAO_REST_KEY 미설정 또는 API 오류) — ${err}`);
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
    debug: { collected: placesWithTags, available, scored: scoredWithCourse },
  };
}
