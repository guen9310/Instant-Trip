import type {
  UserProfile,
  CourseResult,
  PipelineResult,
  PlaceWithTags,
} from "@/lib/pipeline/types";
import { getSearchRadiusM } from "@/lib/pipeline/types";
import { collectCandidates } from "@/lib/pipeline/collect";
import { filterByAvailability } from "@/lib/pipeline/availability";
import type { TourItem } from "@/lib/tour/types";
import { scoreCandidates, applyMappingRules } from "@/lib/pipeline/scoring";
import { assembleCourse } from "@/lib/pipeline/course";
import {
  supplementWithKakao,
  KAKAO_SUPPLEMENT_MIN,
} from "@/lib/pipeline/kakaoCollect";
import { fetchNearbyFestivals } from "@/lib/pipeline/festival";

export type {
  UserProfile,
  CourseResult,
  PipelineResult,
  TravelScale,
  TagKey,
  TagWeights,
  OnboardingAnswers,
} from "@/lib/pipeline/types";
export { onboardingToProfile, getSearchRadiusM } from "@/lib/pipeline/types";

function elapsed(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
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
  const radiusKm = getSearchRadiusM(profile) / 1000;
  const { mapY: lat, mapX: lng } = profile.location;

  // 축제 조회를 파이프라인과 병렬로 미리 시작 (SWR 적용 후에도 미스 시엔 시간이 걸리므로)
  const festivalPromise = fetchNearbyFestivals(lat, lng, radiusKm, {
    simulationDate: options.simulationDate,
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
      festivals: { ongoing: [], upcoming: [] },
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
      festivals: { ongoing: [], upcoming: [] },
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
        getSearchRadiusM(profile),
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
  // 데이터 출처: item.source === "kakao" → Kakao 로컬 API 보충분 / 그 외 → 한국관광공사 Tour API
  const excludeSet = new Set(options.excludeIds ?? []);
  const availableWithTags: PlaceWithTags[] = availablePool
    .filter((item) => !excludeSet.has(item.contentid))
    .map((item) => ({
      ...item,
      // Kakao 보충 아이템은 tagScores가 없으므로 항상 applyMappingRules 적용
      tagScores: (item as PlaceWithTags).tagScores ?? applyMappingRules(item),
      // filterByAvailability가 부착한 플래그; 카카오 보충 아이템은 운영시간 데이터가
      // 아예 없으므로(가용성 검사 미통과) 항상 불확실로 처리한다.
      availabilityUncertain:
        (item as PlaceWithTags).availabilityUncertain ?? item.source === "kakao",
    }));
  if (excludeSet.size > 0) {
    console.log(
      `[pipeline] excludeIds ${excludeSet.size}건 제외 — ${available.length} → ${availableWithTags.length}건`,
    );
  }

  ts = Date.now();
  const scored = await scoreCandidates(availableWithTags, profile);
  const tourScored = scored.filter((p) => p.item.source !== "kakao").length;
  const kakaoScored = scored.filter((p) => p.item.source === "kakao").length;
  console.log(
    `[pipeline] stage4 완료 — ${scored.length}건 점수화 (관광공사:${tourScored} / 카카오:${kakaoScored}) | ${elapsed(Date.now() - ts)}`,
  );

  const allCandidates = [...scored];

  // stage5: 최종 코스 조립
  ts = Date.now();
  const courseBase = await assembleCourse(allCandidates, profile);
  console.log(
    `[pipeline] stage5 완료 — 메인 ${courseBase.mainPlace ? 1 : 0}곳 + 연계 ${courseBase.nearbyPlaces.length}곳 | ${elapsed(Date.now() - ts)}`,
  );

  ts = Date.now();
  const { ongoing: festivalsOngoing, upcoming: festivalsUpcoming } =
    await festivalPromise;
  console.log(
    `[pipeline] 문화축제 — 진행중 ${festivalsOngoing.length}건 / 예정 ${festivalsUpcoming.length}건 | ${elapsed(Date.now() - ts)}`,
  );

  const course: CourseResult = {
    ...courseBase,
    festivals: { ongoing: festivalsOngoing, upcoming: festivalsUpcoming },
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
