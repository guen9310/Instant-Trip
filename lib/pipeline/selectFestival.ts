import { toShortAddress, fetchDetail, stripHtml } from "@/lib/pipeline/course";
import { getFestivalIntro, cleanFestivalText, parseFestivalProgram } from "@/lib/tour/festivalDetail";
import { fetchNearbyFestivals } from "@/lib/pipeline/festival";
import { parseTimeRange, isWithinRange } from "@/lib/pipeline/availability";
import { STAY_DURATION_DEFAULT } from "@/lib/pipeline/stayDuration";
import { getKstDateString, getKstHour, getKstMinute } from "@/shared/utils/kst";
import { isBlank } from "@/shared/utils";
import type { CoursePlace } from "@/lib/pipeline/types";
import type { PlaceAvailability } from "@/lib/pipeline/selectPlace";
import type { CulturalFestival } from "@/lib/clients/cultural-festival";
import type { FestivalProgramInfo, FestivalPhase } from "@/shared/types/course.types";

const FESTIVAL_CONTENT_TYPE_ID = "15";
// 홈 카드 선택(generateCourseFromPlace)과 동일한 탐색 반경 관행을 따른다.
const SELECTED_FESTIVAL_RADIUS_KM = 20;

export type GenerateCourseFromFestivalInput = {
  // FestivalSummary.id(합성 문자열) — Tour API contentId가 없는 축제의 CoursePlace.contentId로도 쓴다.
  id: string;
  // Tour API와 매칭된 경우에만 존재. 있으면 detailIntro2로 program·playtime을 보강한다.
  contentId: string | null;
  name: string;
  address: string;
  lat: number;
  lng: number;
  // YYYY-MM-DD 원본 — "지금 진행 중인가" 판정에 쓴다(표시용 period는 화면 층이 이미 갖고 있음).
  startDate: string;
  endDate: string;
  description: string | null;
  imageUrl: string | null;
};

export type GenerateCourseFromFestivalResult =
  | {
      ok: true;
      mainPlace: CoursePlace;
      availability: PlaceAvailability;
      festivals: { ongoing: CulturalFestival[]; upcoming: CulturalFestival[] };
    }
  | { ok: false; code: "UNKNOWN"; error: string };

// [축제 선택 진입 — 데이터 층] 홈 "주변 축제" 카드에서 사용자가 직접 고른 축제로 코스를
// 만든다. 장소 선택 진입(generateCourseFromPlace)과 대응되지만, 축제는 요일별 영업시간이
// 아니라 기간(startDate~endDate) + 당일 운영시간(playtime)으로 가용성을 판정하므로
// checkPlaceAvailability(요일 인지 판정)를 재사용하지 않고 별도 로직을 둔다.
//
// 공공데이터포털 단독 축제(contentId 없음)는 detailCommon2/detailIntro2를 호출할 수 없어
// (Tour API에 대응 항목 자체가 없음) 입력 페이로드(이미 홈 화면이 갖고 있던 FestivalSummary
// 필드)만으로 CoursePlace를 조립한다 — Kakao 출처 장소가 TourAPI 상세 조회를 건너뛰는 것과
// 같은 원리다.
export async function generateCourseFromFestival(
  input: GenerateCourseFromFestivalInput,
): Promise<GenerateCourseFromFestivalResult> {
  try {
    const { id, contentId, name, address, lat, lng, startDate, endDate, description, imageUrl } =
      input;

    // 오늘(KST, YYYY-MM-DD)과 시작일·종료일을 문자열 그대로 비교한다 — 둘 다 같은
    // YYYY-MM-DD 포맷이라 사전식 비교가 곧 날짜 비교와 같다(lib/pipeline/festival.ts의
    // splitOngoingUpcoming과 동일한 방식). isOpenNow(boolean)만으로는 "시작 전"과
    // "이미 끝남"을 구분할 수 없어서 3단계로 나눈다.
    const today = getKstDateString();
    const festivalPhase: FestivalPhase =
      today < startDate ? "upcoming" : today > endDate ? "ended" : "ongoing";
    const inDateRange = festivalPhase === "ongoing";

    // overview(detailCommon2, 서술형 소개글)가 program(detailIntro2, 프로그램 나열)보다
    // 문장이 훨씬 자연스러워 우선한다 — 일반 장소(buildCoursePlace)가 overview를 소개글로
    // 쓰는 것과 동일한 우선순위다. 매칭 안 된 축제는 공공데이터포털 fstvlCo가 최후 폴백.
    // program은 overview와 별개로 "행사 프로그램" 섹션(programInfo)에 그대로 보존한다 —
    // 소개글 자리를 채우는 폴백으로 소모되고 나면 이 섹션에 보여줄 게 없어지기 때문이다.
    let overview: string | null = null;
    let program: string | null = null;
    let playtime: string | null = null;
    let organizerUrl: string | null = null;
    if (contentId) {
      const [detail, intro] = await Promise.all([
        fetchDetail(contentId),
        getFestivalIntro(contentId),
      ]);
      overview = detail?.overview ? stripHtml(detail.overview) : null;
      program = intro?.program ? cleanFestivalText(intro.program) : null;
      playtime = intro?.playtime ? cleanFestivalText(intro.playtime) : null;
      organizerUrl =
        normalizeUrl(detail?.homepage ? stripHtml(detail.homepage) : null) ??
        normalizeUrl(intro?.eventhomepage ?? null);
    }
    const programInfo: FestivalProgramInfo | null = program ? parseFestivalProgram(program) : null;

    // 날짜 범위 안이고 playtime(당일 운영시간)까지 있으면 현재 시각도 그 안인지 확인한다.
    // playtime이 없거나 파싱 실패하면 날짜 판정만으로 관대 처리(다른 장소들의 "관대 처리
    // 원칙"과 동일한 태도 — 시각 단위 정보가 없다고 차단하지 않는다).
    let isOpenNow = inDateRange;
    if (inDateRange && playtime) {
      const range = parseTimeRange(playtime);
      if (range) {
        const curMinutes = getKstHour() * 60 + getKstMinute();
        isOpenNow = isWithinRange(range, curMinutes);
      }
    }

    const period = `${formatShortDate(startDate)} ~ ${formatShortDate(endDate)}`;
    const hours = [period, playtime].filter(Boolean).join(" · ");

    const mainPlace: CoursePlace = {
      contentId: contentId ?? id,
      contentTypeId: FESTIVAL_CONTENT_TYPE_ID,
      title: name,
      address,
      shortAddress: toShortAddress(address),
      overview: overview ?? program ?? description ?? "",
      images: imageUrl ? [imageUrl] : [],
      coord: { lat, lng },
      tags: [],
      score: 0,
      // 날짜(YYYY-MM-DD)는 항상 확실한 값이라 "판단 불가" 상태가 없다.
      availabilityUncertain: false,
      estimatedDuration: STAY_DURATION_DEFAULT,
      origin: "selected",
      hours,
      programInfo,
      organizerUrl,
      festivalPhase,
      festivalStartLabel: formatShortDate(startDate),
    };

    const availability: PlaceAvailability = {
      isOpenNow,
      hours: hours || null,
      restDayNote: null,
    };

    const festivals = await fetchNearbyFestivals(lat, lng, SELECTED_FESTIVAL_RADIUS_KM);

    return { ok: true, mainPlace, availability, festivals };
  } catch (err) {
    return {
      ok: false,
      code: "UNKNOWN",
      error: err instanceof Error ? err.message : "코스 생성 중 오류가 발생했습니다.",
    };
  }
}

function formatShortDate(yyyyMmDd: string): string {
  const match = yyyyMmDd.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}.${match[2]}` : yyyyMmDd;
}

// homepage/eventhomepage는 공공 API 특성상 스킴이 빠져 있거나("ulsan.go.kr") 빈 값인
// 경우가 있다. 빈 값은 null로, 스킴 없는 값은 http://를 붙여 실제 링크로 쓸 수 있게 한다.
function normalizeUrl(raw: string | null): string | null {
  if (isBlank(raw)) return null;
  const trimmed = raw!.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}
