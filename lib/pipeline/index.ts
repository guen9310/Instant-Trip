import type {
  UserProfile,
  CourseResult,
  PipelineResult,
  PlaceWithTags,
} from "@/lib/pipeline/types";
import { getSearchRadiusM } from "@/lib/pipeline/types";
import { collectCandidates } from "@/lib/pipeline/collect";
import { selectAvailableCandidate } from "@/lib/pipeline/availabilityGate";
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
  PlaceOrigin,
} from "@/lib/pipeline/types";
export { getSearchRadiusM } from "@/lib/pipeline/types";
export { generateCourseFromPlace } from "@/lib/pipeline/selectPlace";
export type {
  GenerateCourseFromPlaceInput,
  GenerateCourseFromPlaceResult,
  PlaceAvailability,
} from "@/lib/pipeline/selectPlace";
export { generateCourseFromFestival } from "@/lib/pipeline/selectFestival";
export type {
  GenerateCourseFromFestivalInput,
  GenerateCourseFromFestivalResult,
} from "@/lib/pipeline/selectFestival";

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

  // stage3.5: 가볍게 + stage1 원본 수집 건수 부족 시 카카오 후보 보충
  // (트리거 기준이 가용성 통과분 → 원본 수집분으로 변경됨: 아래 신규 순차 가용성
  // 게이트 이전이라 아직 "가용 통과 건수"라는 개념 자체가 없기 때문)
  let mergedPool: TourItem[] = items;
  if (profile.scale === "가볍게" && items.length < KAKAO_SUPPLEMENT_MIN) {
    try {
      ts = Date.now();
      mergedPool = await supplementWithKakao(
        items,
        lat,
        lng,
        getSearchRadiusM(profile),
      );
      console.log(
        `[pipeline] stage3.5 보충 완료 — ${items.length} → ${mergedPool.length}건 | ${elapsed(Date.now() - ts)}`,
      );
    } catch (err) {
      console.warn(`[pipeline] stage3.5 카카오 보충 실패, 기존 후보 유지 — ${err}`);
    }
  } else if (profile.scale === "가볍게") {
    console.log(
      `[pipeline] stage3.5 보충 스킵 — 수집 ${items.length}건 ≥ ${KAKAO_SUPPLEMENT_MIN}`,
    );
  }

  // source 분포 로깅
  const tourCount = mergedPool.filter((i) => i.source !== "kakao").length;
  const kakaoCount = mergedPool.filter((i) => i.source === "kakao").length;
  if (kakaoCount > 0) {
    console.log(`[pipeline] 후보 source 분포 — tour:${tourCount} / kakao:${kakaoCount}`);
  }

  // excludeIds에 포함된 장소는 점수화 이전에 제외한다 (거절 재추천용) —
  // 게이트가 이미 거절된 후보를 다시 확인하는 낭비를 막는다.
  const excludeSet = new Set(options.excludeIds ?? []);
  const filteredPool = mergedPool.filter((item) => !excludeSet.has(item.contentid));
  if (excludeSet.size > 0) {
    console.log(
      `[pipeline] excludeIds ${excludeSet.size}건 제외 — ${mergedPool.length} → ${filteredPool.length}건`,
    );
  }

  // stage4: 점수화 — 운영시간 데이터 없이 stage1 필드만으로 계산되므로
  // tour/kakao 구분 없이 한 번에 태그를 붙인다.
  ts = Date.now();
  const placesWithTags: PlaceWithTags[] = filteredPool.map((item) => ({
    ...item,
    tagScores: applyMappingRules(item),
  }));
  const scored = await scoreCandidates(placesWithTags, profile);
  const tourScored = scored.filter((p) => p.item.source !== "kakao").length;
  const kakaoScored = scored.filter((p) => p.item.source === "kakao").length;
  console.log(
    `[pipeline] stage4 완료 — ${scored.length}건 점수화 (관광공사:${tourScored} / 카카오:${kakaoScored}) | ${elapsed(Date.now() - ts)}`,
  );

  // 신규: 점수 순으로 하나씩만 운영시간을 확인해 최초로 열려있는 후보를 채택한다
  // (기존엔 stage2가 전체를 미리 검사했으나, 점수화가 운영시간 데이터를 쓰지 않으므로
  // 순서를 뒤집어 TourAPI 호출을 80~120건에서 보통 1~수건으로 줄인다)
  ts = Date.now();
  const gate = await selectAvailableCandidate(scored);
  console.log(
    gate
      ? `[gate] 완료 — "${gate.winner.item.title}" 채택 (검사 ${gate.checksPerformed}건${gate.exhausted ? ", 상한소진→1위 폴백" : ""}) | ${elapsed(Date.now() - ts)}`
      : `[gate] 완료 — 채택 후보 없음 | ${elapsed(Date.now() - ts)}`,
  );

  const allCandidates = gate
    ? scored.map((c) =>
        c.item.contentid === gate.winner.item.contentid ? gate.winner : c,
      )
    : scored;

  // stage5: 최종 코스 조립 — 채택된 1건(또는 0건)만 넘긴다.
  // assembleCourse는 scored[0]만 읽고 nearbyPlaces는 항상 []를 반환하므로 안전하다.
  ts = Date.now();
  const courseBase = await assembleCourse(gate ? [gate.winner] : [], profile);
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
    debug: { collected: mergedPool, available: filteredPool, scored: scoredWithCourse },
  };
}
