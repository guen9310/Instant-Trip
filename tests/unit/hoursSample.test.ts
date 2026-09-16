import { describe, it, expect } from "vitest";
import sample from "@/tests/fixtures/tourapi-hours-sample-2026-09.json";
import expectedTable from "@/tests/fixtures/tourapi-hours-sample-2026-09.expected.json";
import { checkOpenByDayAwareHours } from "@/lib/tour/hours";
import { stripBrTags } from "@/lib/pipeline/availability";
import type { AvailabilityStatus } from "@/shared/types/availability.types";

// 2026-09-16 실측 — TourAPI locationBasedList2(서울·원주·강릉·부산·전주 반경 10km, 관광지·
// 문화시설·레포츠) 상위 항목의 detailIntro2 원문 84건. 원문은 받은 그대로 두고, 판정은
// 실제 파이프라인(availability.ts)과 같게 stripBrTags를 거친 뒤 넣는다.
type SampleRow = (typeof sample)[number];

// 판정 시각 — 요일·공휴일·시간대별 규칙을 각각 건드리도록 고른 KST 시각.
const AT = {
  wed1100: "2026-09-16T11:00:00+09:00", // 평일 오전
  wed1230: "2026-09-16T12:30:00+09:00", // 점심 준비·휴게시간대
  wed1500: "2026-09-16T15:00:00+09:00", // 평일 오후
  wed1630: "2026-09-16T16:30:00+09:00", // 입장 마감 경계
  sat1500: "2026-09-19T15:00:00+09:00", // 토요일
  sat1600: "2026-09-19T16:00:00+09:00", // 토요일 휴게시간대
  sun1100: "2026-09-20T11:00:00+09:00", // 일요일
  mon1200: "2026-09-14T12:00:00+09:00", // 월요일
  chuseok: "2026-09-25T12:00:00+09:00", // 추석 당일(금)
  subHoliday: "2026-10-05T12:00:00+09:00", // 개천절 대체공휴일(월)
  afterHoliday: "2026-10-06T12:00:00+09:00", // 대체공휴일 다음 날(화)
} as const;

type Moment = keyof typeof AT;

function judge(title: string, moment: Moment, expectedDurationMinutes = 60) {
  const row = (sample as SampleRow[]).find((r) => r.title === title);
  if (!row) throw new Error(`fixture에 없는 장소: ${title}`);
  return checkOpenByDayAwareHours(
    row.usetime ? stripBrTags(row.usetime) : null,
    row.restdate ? stripBrTags(row.restdate) : null,
    { now: new Date(AT[moment]), expectedDurationMinutes },
  );
}

// [장소, 시각, 올바른 판정, 근거] — 원문을 사람이 읽고 정한 기대값이다. 현재 코드의 출력을
// 받아 적은 것이 아니다. "uncertain"은 원문에 읽지 못한 조건이 남아 영업 여부를 단정할 수
// 없다는 뜻이다(운영시간 확인 카드가 뜨는 상태).
const CASES: [string, Moment, AvailabilityStatus, string][] = [
  // 휴무 요일 목록 끝까지 읽기
  ["쾨닉 서울", "mon1200", "closed_restday", "매주 일요일 / 월요일 — 월요일 휴무"],
  ["갤러리에스피", "mon1200", "closed_restday", "매주 일요일, 월요일 — 월요일 휴무"],
  ["원주향교", "sun1100", "closed_restday", "매주 토요일~일요일 — 일요일 휴무"],
  ["전북도청도서관", "sat1500", "closed_restday", "주말 휴무"],
  ["강릉단오제전수교육관", "sun1100", "closed_restday", "… / 일요일 — 일요일 휴무"],
  ["책방봄봄", "mon1200", "closed_restday", "매주 일요일 / 월요일 — 월요일 휴무"],
  ["부산점자도서관", "sat1500", "closed_restday", "매주 주말 휴무"],

  // 문장 속 "월"·"일" 글자를 요일로 오인하지 않기, 월 구간 읽기
  ["부산점자도서관", "wed1100", "open", "3~10월 09:00~18:00, 수요일은 휴무 아님"],
  ["김달진미술자료박물관", "wed1500", "uncertain", "[평일] 10~17이지만 '매월 말 마지막 평일은 15시부터' 조건이 남음"],
  ["뒷뜨루관광농원", "wed1630", "open", "하절기(3~10월) 입장 마감 17:00"],

  // 휴게·준비시간
  ["나루아트센터", "wed1230", "before_open", "준비 시간 12:00~13:00 — 13:00 재개"],
  ["수상한마법학교", "sat1600", "before_open", "토요일 휴게시간 15:30~16:30 — 16:30 재개"],

  // 공휴일·명절 휴무를 날짜로 대조
  ["조엄기념관", "chuseok", "closed_restday", "설·추석 당일 휴무"],
  ["원주향교", "subHoliday", "closed_restday", "공휴일 휴무(대체공휴일 포함)"],
  ["강릉올림픽뮤지엄", "subHoliday", "closed_restday", "법정공휴일 및 대체휴무일 휴관"],
  ["고래책방", "wed1100", "open", "설·추석 당일만 휴무 — 평일은 영업"],

  // 공휴일 예외·다음 날 휴관 조항
  ["강릉시립미술관 교동", "subHoliday", "open", "월요일이 공휴일이면 정상 개관"],
  ["강릉시립미술관 교동", "afterHoliday", "closed_restday", "공휴일 월요일의 다음 날 휴관"],
  ["부산근현대역사관 본관", "subHoliday", "open", "월요일이 공휴일이면 다음날 화요일 휴관 → 월요일은 개관"],
  ["부산근현대역사관 본관", "afterHoliday", "closed_restday", "다음날 화요일 휴관"],
  ["전주자연생태관", "mon1200", "closed_restday", "평범한 월요일은 휴무"],
  ["전주자연생태관", "wed1100", "open", "09:00~18:00, 하절기(5~9월) 1시간 연장 — 9월 수요일은 영업"],

  // 방문 가능 여부를 바꾸는 조건이 남았을 때만 영업 중이라고 단정하지 않기
  ["간송미술관(서울 보화각)", "wed1100", "uncertain", "전시 기간에만 운영 — 기간 조건"],
  ["책방봄봄", "wed1630", "uncertain", "예약제로 운영"],
  ["김달진미술자료박물관", "wed1100", "uncertain", "매월 말 마지막 평일은 15시부터 — 해석 못 한 날짜 조건"],
  ["백악미술관", "wed1100", "open", "'주일단위 전시' 안내는 방문 조건이 아님"],
  ["전주완산도서관", "wed1100", "open", "시설 이름 나열은 방문 조건이 아님 — 월~목 09:00~18:00"],

  // 회귀 — 원래 맞던 판정이 유지되는지
  ["서대문독립공원", "wed1100", "open", "상시 개방 / 연중무휴"],
  ["동네책방 스몰굿씽", "wed1100", "before_open", "12:00 개점"],
  ["사천진항", "wed1100", "uncertain", "휴무일 원문 없음"],
  ["북한산 자락길", "wed1100", "no_data", "운영시간·휴무일 원문 없음"],
  ["신당동 떡볶이타운", "wed1100", "uncertain", "점포 별로 상이함"],
  ["강원감영관찰사·무릉고서화미술박물관", "sat1500", "closed_hours", "토요일 10:00~13:00"],
  ["사당청소년센터", "sun1100", "open", "- 일요일 / 공휴일 09:00~18:00 — '/'로 나뉜 요일을 합쳐 읽음"],
];

describe("TourAPI 운영시간 실측 원문 84건 — 사람이 판단한 기대값", () => {
  it.each(CASES)("%s @ %s → %s (%s)", (title, moment, expected) => {
    expect(judge(title, moment).status).toBe(expected);
  });
});

// 84건 × 9개 시각 전체 판정표 — 규칙을 바꿀 때 어떤 장소의 어떤 시각 판정이 달라지는지 한눈에
// 보이게 한다. 표는 2026-09-16 개정 규칙의 출력을 원문과 한 건씩 대조해 확인한 뒤 고정했다.
// 규칙을 고쳐 이 테스트가 깨지면, 달라진 판정이 원문상 맞는지 확인하고 표를 함께 갱신한다.
const TABLE_AT = {
  wed1100: AT.wed1100,
  wed1230: AT.wed1230,
  wed1630: AT.wed1630,
  sat1500: AT.sat1500,
  sun1100: AT.sun1100,
  mon1200: AT.mon1200,
  chuseok1200: AT.chuseok,
  subHolidayMon1200: AT.subHoliday,
  tueAfterHoliday1200: AT.afterHoliday,
} as const;

describe("TourAPI 운영시간 실측 원문 84건 — 전체 판정표", () => {
  it("모든 장소·시각의 판정이 검토된 표와 같다", () => {
    const actual = (sample as SampleRow[]).map((row) => {
      const usetime = row.usetime ? stripBrTags(row.usetime) : null;
      const restdate = row.restdate ? stripBrTags(row.restdate) : null;
      return {
        title: row.title,
        ...Object.fromEntries(
          Object.entries(TABLE_AT).map(([key, at]) => [
            key,
            checkOpenByDayAwareHours(usetime, restdate, { now: new Date(at), expectedDurationMinutes: 60 }).status,
          ]),
        ),
      };
    });
    expect(actual).toEqual(expectedTable);
  });
});
