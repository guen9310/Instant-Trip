// 대한민국 관공서 공휴일 정적 표 — 운영시간 판정(lib/tour/hours.ts)이 TourAPI 휴무일 원문의
// "공휴일 휴무"·"설·추석 당일"·"공휴일인 경우 다음날 휴관" 같은 조건을 오늘 날짜와 대조하는 데 쓴다.
//
// 외부 API(한국천문연구원 특일 정보) 대신 정적 표를 둔 이유: 필요한 것은 "오늘이 공휴일인가"
// 하나이고, 연 단위로 미리 공표되는 값이라 매 요청 조회할 이유가 없다. 대신 임시공휴일이
// 새로 지정되면 이 표를 직접 고쳐야 한다. 표에 없는 연도는 "공휴일 여부 모름"으로 취급된다
// (shared/utils/holidays.ts) — 연 1회, 다음 해 월력요항이 발표되면 갱신한다.
//
// 출처: 우주항공청 월력요항(2026·2027) 기준 보도 정리. 2026년부터 노동절(5/1) 신설·제헌절(7/17)
// 공휴일 재지정이 반영돼 있다. 2026-06-03은 전국동시지방선거일이다.

export type HolidayFestival = "seollal" | "chuseok";

export type HolidayEntry = {
  date: string; // YYYY-MM-DD (KST)
  name: string;
  // 설날·추석 연휴에 속하는 날. "설·추석 당일" 휴무는 isMainDay만, "설 연휴 휴무"는 연휴 전체로 대조한다.
  festival?: HolidayFestival;
  isMainDay?: boolean;
};

export const KR_HOLIDAYS: Readonly<Record<number, readonly HolidayEntry[]>> = {
  2026: [
    { date: "2026-01-01", name: "신정" },
    { date: "2026-02-16", name: "설날 전날", festival: "seollal" },
    { date: "2026-02-17", name: "설날", festival: "seollal", isMainDay: true },
    { date: "2026-02-18", name: "설날 다음날", festival: "seollal" },
    { date: "2026-03-01", name: "삼일절" },
    { date: "2026-03-02", name: "삼일절 대체공휴일" },
    { date: "2026-05-01", name: "노동절" },
    { date: "2026-05-05", name: "어린이날" },
    { date: "2026-05-24", name: "부처님오신날" },
    { date: "2026-05-25", name: "부처님오신날 대체공휴일" },
    { date: "2026-06-03", name: "전국동시지방선거" },
    { date: "2026-06-06", name: "현충일" },
    { date: "2026-07-17", name: "제헌절" },
    { date: "2026-08-15", name: "광복절" },
    { date: "2026-08-17", name: "광복절 대체공휴일" },
    { date: "2026-09-24", name: "추석 전날", festival: "chuseok" },
    { date: "2026-09-25", name: "추석", festival: "chuseok", isMainDay: true },
    { date: "2026-09-26", name: "추석 다음날", festival: "chuseok" },
    { date: "2026-10-03", name: "개천절" },
    { date: "2026-10-05", name: "개천절 대체공휴일" },
    { date: "2026-10-09", name: "한글날" },
    { date: "2026-12-25", name: "성탄절" },
  ],
  2027: [
    { date: "2027-01-01", name: "신정" },
    { date: "2027-02-06", name: "설날 전날", festival: "seollal" },
    { date: "2027-02-07", name: "설날", festival: "seollal", isMainDay: true },
    { date: "2027-02-08", name: "설날 다음날", festival: "seollal" },
    { date: "2027-02-09", name: "설날 대체공휴일", festival: "seollal" },
    { date: "2027-03-01", name: "삼일절" },
    { date: "2027-05-01", name: "노동절" },
    { date: "2027-05-03", name: "노동절 대체공휴일" },
    { date: "2027-05-05", name: "어린이날" },
    { date: "2027-05-13", name: "부처님오신날" },
    { date: "2027-06-06", name: "현충일" },
    { date: "2027-07-17", name: "제헌절" },
    { date: "2027-07-19", name: "제헌절 대체공휴일" },
    { date: "2027-08-15", name: "광복절" },
    { date: "2027-08-16", name: "광복절 대체공휴일" },
    { date: "2027-09-14", name: "추석 전날", festival: "chuseok" },
    { date: "2027-09-15", name: "추석", festival: "chuseok", isMainDay: true },
    { date: "2027-09-16", name: "추석 다음날", festival: "chuseok" },
    { date: "2027-10-03", name: "개천절" },
    { date: "2027-10-04", name: "개천절 대체공휴일" },
    { date: "2027-10-09", name: "한글날" },
    { date: "2027-10-11", name: "한글날 대체공휴일" },
    { date: "2027-12-25", name: "성탄절" },
    { date: "2027-12-27", name: "성탄절 대체공휴일" },
  ],
};
