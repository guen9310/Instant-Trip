import type { CourseData } from "@/shared/types/feed.types";

export type WeatherCondition = "clear" | "cloudy" | "rain" | "snow";
export type TimeSlot = "morning" | "afternoon" | "evening" | "night";

export function generateContextLabel(
  course: CourseData,
  hour: number,
): string | undefined {
  // 서버/수동 오버라이드 우선
  if (course.contextLabel) return course.contextLabel;

  // 방금 다녀간 사람이 있으면 사회적 증거 우선
  if (course.todayCompletions?.timeframe === "방금") {
    return "방금 누군가 다녀갔어요";
  }

  const slot = getTimeSlot(hour);
  const text = course.name + " " + course.id;

  if (slot === "evening") {
    if (/노을|선셋/.test(text)) return "지금 딱 노을 시간이에요";
    if (/야경/.test(text)) return "지금 딱 야경 시간이에요";
    return "퇴근하고 가기 딱 좋아요";
  }

  if (slot === "night") {
    if (/야경/.test(text)) return "지금 딱 야경 시간이에요";
  }

  if (slot === "morning") {
    if (/둘레길|공원|한강|산/.test(text)) return "아침 산책하기 딱 좋아요";
  }

  return undefined;
}

export type ShowCondition = {
  weather?: WeatherCondition[];
  timeSlot?: TimeSlot[];
  /** 0=일요일, 1–5=평일, 6=토요일 */
  weekday?: number[];
  hasFestival?: boolean;
};

export type CourseWithCondition = CourseData & {
  showConditions?: ShowCondition[];
  priority?: number;
};

export function getTimeSlot(hour: number): TimeSlot {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 21) return "evening";
  return "night";
}

type FilterContext = {
  weather: WeatherCondition;
  hour: number;
  isWeekend: boolean;
};

function matchesCondition(
  course: CourseWithCondition,
  ctx: FilterContext,
): boolean {
  const conditions = course.showConditions;
  if (!conditions || conditions.length === 0) return true;

  const slot = getTimeSlot(ctx.hour);
  const weekday = ctx.isWeekend ? (ctx.hour < 12 ? 0 : 6) : 1;

  return conditions.some((cond) => {
    if (cond.weather && !cond.weather.includes(ctx.weather)) return false;
    if (cond.timeSlot && !cond.timeSlot.includes(slot)) return false;
    if (cond.weekday && !cond.weekday.includes(weekday)) return false;
    if (cond.hasFestival !== undefined && cond.hasFestival !== !!course.festival)
      return false;
    return true;
  });
}

export function filterByCondition(
  courses: CourseWithCondition[],
  ctx: FilterContext,
): CourseWithCondition[] {
  return courses
    .filter((c) => matchesCondition(c, ctx))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}
