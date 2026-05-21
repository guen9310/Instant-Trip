import { describe, it, expect } from "vitest";
import {
  getTimeSlot,
  generateContextLabel,
  filterByCondition,
  type CourseWithCondition,
} from "@/shared/utils/feedContext";
import type { FeedCourse } from "@/shared/types/feed.types";

/* ──────────────────────────────────────────────
 *  getTimeSlot — 시간대 경계값 테스트
 * ────────────────────────────────────────────── */
describe("getTimeSlot", () => {
  it.each([
    [5, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [17, "afternoon"],
    [18, "evening"],
    [20, "evening"],
    [21, "night"],
    [0, "night"],
    [4, "night"],
  ] as const)("hour %i → %s", (hour, expected) => {
    expect(getTimeSlot(hour)).toBe(expected);
  });
});

/* ──────────────────────────────────────────────
 *  generateContextLabel — 맥락 라벨 생성
 * ────────────────────────────────────────────── */
describe("generateContextLabel", () => {
  const baseCourse: FeedCourse = {
    id: "test",
    name: "테스트 코스",
    region: "서울",
    rating: 4.5,
    count: 10,
    availability: "available",
    places: [],
  };

  it("contextLabel이 이미 있으면 그대로 반환한다", () => {
    const course = { ...baseCourse, contextLabel: "커스텀 라벨" };
    expect(generateContextLabel(course, 14)).toBe("커스텀 라벨");
  });

  it("방금 다녀간 사람이 있으면 소셜 증거 라벨을 반환한다", () => {
    const course: FeedCourse = {
      ...baseCourse,
      todayCompletions: { count: 1, timeframe: "방금" },
    };
    expect(generateContextLabel(course, 14)).toBe("방금 누군가 다녀갔어요");
  });

  it("오늘 다녀간 사람만 있으면 소셜 증거를 반환하지 않는다", () => {
    const course: FeedCourse = {
      ...baseCourse,
      todayCompletions: { count: 5, timeframe: "오늘" },
    };
    // "오늘" 은 소셜 증거 우선 조건이 아님 → 시간대 분기로 넘어감
    expect(generateContextLabel(course, 14)).toBeUndefined();
  });

  it("저녁 시간 + 노을 키워드 → 노을 메시지", () => {
    const course = { ...baseCourse, name: "한강 노을 코스" };
    expect(generateContextLabel(course, 18)).toBe("지금 딱 노을 시간이에요");
  });

  it("저녁 시간 + 야경 키워드 → 야경 메시지", () => {
    const course = { ...baseCourse, name: "경복궁 야경" };
    expect(generateContextLabel(course, 19)).toBe("지금 딱 야경 시간이에요");
  });

  it("저녁 시간 + 일반 코스 → 퇴근 메시지", () => {
    const course = { ...baseCourse, name: "성수 골목 산책" };
    expect(generateContextLabel(course, 20)).toBe("퇴근하고 가기 딱 좋아요");
  });

  it("밤 시간 + 야경 키워드 → 야경 메시지", () => {
    const course = { ...baseCourse, name: "남산 야경" };
    expect(generateContextLabel(course, 21)).toBe("지금 딱 야경 시간이에요");
  });

  it("아침 시간 + 산/공원 키워드 → 아침 산책 메시지", () => {
    const course = { ...baseCourse, name: "한강 공원 투어" };
    expect(generateContextLabel(course, 7)).toBe("아침 산책하기 딱 좋아요");
  });

  it("매칭 키워드 없는 일반 코스 + 오후 → undefined", () => {
    expect(generateContextLabel(baseCourse, 14)).toBeUndefined();
  });
});

/* ──────────────────────────────────────────────
 *  filterByCondition — 조건 기반 필터링
 * ────────────────────────────────────────────── */
describe("filterByCondition", () => {
  const baseCourse: CourseWithCondition = {
    id: "test",
    name: "테스트",
    region: "서울",
    rating: 4.5,
    count: 10,
    availability: "available",
    places: [],
  };

  it("showConditions가 없는 코스는 항상 통과한다", () => {
    const result = filterByCondition([baseCourse], {
      weather: "clear",
      hour: 14,
      isWeekend: false,
    });
    expect(result).toHaveLength(1);
  });

  it("weather 조건 불일치 시 필터링한다", () => {
    const courses: CourseWithCondition[] = [
      {
        ...baseCourse,
        showConditions: [{ weather: ["rain"] }],
      },
    ];
    const result = filterByCondition(courses, {
      weather: "clear",
      hour: 14,
      isWeekend: false,
    });
    expect(result).toHaveLength(0);
  });

  it("weather 조건 일치 시 통과한다", () => {
    const courses: CourseWithCondition[] = [
      {
        ...baseCourse,
        showConditions: [{ weather: ["clear", "cloudy"] }],
      },
    ];
    const result = filterByCondition(courses, {
      weather: "clear",
      hour: 14,
      isWeekend: false,
    });
    expect(result).toHaveLength(1);
  });

  it("timeSlot 조건 불일치 시 필터링한다", () => {
    const courses: CourseWithCondition[] = [
      {
        ...baseCourse,
        showConditions: [{ timeSlot: ["morning"] }],
      },
    ];
    const result = filterByCondition(courses, {
      weather: "clear",
      hour: 14, // afternoon
      isWeekend: false,
    });
    expect(result).toHaveLength(0);
  });

  it("hasFestival 조건으로 필터링한다", () => {
    const courses: CourseWithCondition[] = [
      {
        ...baseCourse,
        festival: false,
        showConditions: [{ hasFestival: true }],
      },
    ];
    const result = filterByCondition(courses, {
      weather: "clear",
      hour: 14,
      isWeekend: false,
    });
    expect(result).toHaveLength(0);
  });

  it("여러 조건 중 하나라도 만족하면 통과한다 (OR 로직)", () => {
    const courses: CourseWithCondition[] = [
      {
        ...baseCourse,
        showConditions: [
          { weather: ["rain"] }, // 불일치
          { timeSlot: ["afternoon"] }, // 일치
        ],
      },
    ];
    const result = filterByCondition(courses, {
      weather: "clear",
      hour: 14,
      isWeekend: false,
    });
    expect(result).toHaveLength(1);
  });

  it("priority 기준으로 내림차순 정렬한다", () => {
    const courses: CourseWithCondition[] = [
      { ...baseCourse, id: "low", priority: 1 },
      { ...baseCourse, id: "high", priority: 10 },
      { ...baseCourse, id: "mid", priority: 5 },
    ];
    const result = filterByCondition(courses, {
      weather: "clear",
      hour: 14,
      isWeekend: false,
    });
    expect(result.map((c) => c.id)).toEqual(["high", "mid", "low"]);
  });

  it("priority가 없으면 0으로 취급한다", () => {
    const courses: CourseWithCondition[] = [
      { ...baseCourse, id: "with", priority: 3 },
      { ...baseCourse, id: "without" }, // priority undefined
    ];
    const result = filterByCondition(courses, {
      weather: "clear",
      hour: 14,
      isWeekend: false,
    });
    expect(result[0].id).toBe("with");
  });
});
