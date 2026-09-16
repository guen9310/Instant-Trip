import { KR_HOLIDAYS } from "@/shared/constants/holidays";
import type { HolidayFestival } from "@/shared/constants/holidays";

export type HolidayInfo = {
  // 이 날짜의 연도가 공휴일 표에 있는지. false면 아래 값은 모두 "모름"이라 판정에 쓰면 안 된다.
  known: boolean;
  isHoliday: boolean;
  // 설날·추석 연휴에 속하면 그 명절, 아니면 null.
  festival: HolidayFestival | null;
  // 설날·추석 당일(연휴 가운데 날)인지.
  isFestivalMainDay: boolean;
};

// "YYYY-MM-DD"(KST) 날짜의 공휴일 정보를 정적 표에서 찾는다.
export function getHolidayInfo(date: string): HolidayInfo {
  const year = Number(date.slice(0, 4));
  const entries = KR_HOLIDAYS[year];
  if (!entries) return { known: false, isHoliday: false, festival: null, isFestivalMainDay: false };

  const entry = entries.find((e) => e.date === date);
  return {
    known: true,
    isHoliday: entry !== undefined,
    festival: entry?.festival ?? null,
    isFestivalMainDay: entry?.isMainDay === true,
  };
}
