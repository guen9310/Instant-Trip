import { fetchDetail, buildCoursePlace } from "@/lib/pipeline/course";
import { checkPlaceAvailability } from "@/lib/pipeline/availability";
import { applyMappingRules } from "@/lib/pipeline/scoring";
import { estimateStayDuration } from "@/lib/pipeline/stayDuration";
import { fetchNearbyFestivals } from "@/lib/pipeline/festival";
import type { CulturalFestival } from "@/lib/clients/cultural-festival";
import type { TourItem } from "@/lib/tour/types";
import type { CoursePlace, PlaceCandidate, TagKey } from "@/lib/pipeline/types";
import type { AvailabilityStatus } from "@/lib/tour/hours";

export type PlaceAvailability = {
  // lib/tour/hours.ts의 판정 상태를 그대로 노출한다 — "판단 불가"(no_data/uncertain)도
  // 있는 그대로 넘긴다. 차단 여부·경고 표시는 화면 층(CourseResultView)의 몫이다.
  status: AvailabilityStatus;
  hours: string | null; // usetime 원문
  restDayNote: string | null; // restdate 원문
};

export type GenerateCourseFromPlaceInput = {
  contentId: string;
  contentTypeId: string;
  lat: number;
  lng: number;
};

export type GenerateCourseFromPlaceResult =
  | {
      ok: true;
      mainPlace: CoursePlace;
      availability: PlaceAvailability;
      festivals: { ongoing: CulturalFestival[]; upcoming: CulturalFestival[] };
    }
  // contentId에 해당하는 장소가 없음 (detailCommon2가 빈 응답) — throw가 아니라 구분 가능한 실패로 반환
  | { ok: false; code: "NOT_FOUND"; error: string }
  | { ok: false; code: "UNKNOWN"; error: string };

// 홈 인기 장소 카드와 동일한 탐색 반경 관행(lib/home/core.ts의 FESTIVAL_RADIUS_KM=20)을 따른다.
// 선택 진입엔 온보딩 scale(여행 규모) 개념이 없어 별도 상수로 둔다.
const SELECTED_FESTIVAL_RADIUS_KM = 20;

// [선택 진입 — 데이터 층] 홈 지역 인기 장소 카드에서 사용자가 직접 고른 Tour 출처 장소로
// 코스를 만든다. stage1(수집)·stage3.5(카카오 보충)·stage4(점수화)는 필요 없다 —
// 이미 사용자가 장소를 정했기 때문이다. stage2(가용성, 단 비차단)와 stage5(조립)만
// 재사용한다.
//
// - 가용성 검사는 차단하지 않는다. 판정 결과를 availability로 그대로 반환하고,
//   경고 표시·차단 여부 결정은 화면 층의 몫이다.
// - 카카오 출처는 범위 밖이다(호출부가 Tour 출처 contentId만 넘긴다는 전제).
export async function generateCourseFromPlace(
  input: GenerateCourseFromPlaceInput,
): Promise<GenerateCourseFromPlaceResult> {
  const { contentId, contentTypeId, lat, lng } = input;

  try {
    // detailCommon2로 존재 여부를 먼저 확인한다 — 없는 contentId는 API가 예외 없이
    // 빈 items(""))로 응답하므로(2026-07-14 실측 확인) fetchDetail이 null을 반환한다.
    const detail = await fetchDetail(contentId);
    if (!detail) {
      return {
        ok: false,
        code: "NOT_FOUND",
        error: `장소를 찾을 수 없습니다 (contentId=${contentId})`,
      };
    }

    // detailCommon2 응답 + 입력 좌표로 TourItem 형태를 구성한다.
    // 좌표는 호출부(홈 근처 카드)가 이미 알고 있는 input.lat/lng를 신뢰한다.
    // lclsSystm1~3은 detailCommon2 실응답엔 포함되지만 기존 TourDetailCommon
    // 타입 선언엔 없던 필드라 lib/tour/types.ts에 optional로 추가했다.
    const item: TourItem = {
      contentid: detail.contentid,
      contenttypeid: contentTypeId,
      title: detail.title,
      addr1: detail.addr1,
      addr2: detail.addr2,
      mapx: String(lng),
      mapy: String(lat),
      firstimage: detail.firstimage,
      firstimage2: detail.firstimage2,
      areacode: detail.areacode ?? "",
      sigungucode: detail.sigungucode ?? "",
      createdtime: detail.createdtime,
      modifiedtime: detail.modifiedtime,
      tel: detail.tel,
      lclsSystm1: detail.lclsSystm1,
      lclsSystm2: detail.lclsSystm2,
      lclsSystm3: detail.lclsSystm3,
      source: "tour",
    };

    const [availabilityCheck, festivals] = await Promise.all([
      checkPlaceAvailability(item, `[선택] "${item.title}"`),
      fetchNearbyFestivals(lat, lng, SELECTED_FESTIVAL_RADIUS_KM),
    ]);

    const tagScores = applyMappingRules(item);
    const tags = (Object.entries(tagScores) as [TagKey, number][])
      .filter(([, s]) => s > 0)
      .map(([t]) => t);
    const estimatedDuration = estimateStayDuration(item);

    const candidate: PlaceCandidate = {
      item,
      tagScores,
      tags,
      // 직접 선택된 장소라 순위가 없다 — score는 추천 점수와 비교되지 않는 "적용 불가" 값.
      score: 0,
      available: true,
      availabilityUncertain: availabilityCheck.status !== "open",
      estimatedDuration,
      hours: availabilityCheck.hours,
      restDayNote: availabilityCheck.restDayNote,
    };

    // buildCoursePlace가 내부에서 fetchDetail(contentId)를 다시 호출하지만,
    // 위 fetchDetail 호출로 이미 7일 캐시에 적재돼 있어 캐시 HIT으로 처리된다
    // (lib/pipeline/course.ts의 dbCache 경로를 그대로 탄다 — 별도 분기를 만들지 않는다).
    const mainPlace = await buildCoursePlace(candidate, "[선택]", "selected");

    const availability: PlaceAvailability = {
      status: availabilityCheck.status,
      hours: availabilityCheck.hours,
      restDayNote: availabilityCheck.restDayNote,
    };

    return { ok: true, mainPlace, availability, festivals };
  } catch (err) {
    return {
      ok: false,
      code: "UNKNOWN",
      error:
        err instanceof Error ? err.message : "코스 생성 중 오류가 발생했습니다.",
    };
  }
}
