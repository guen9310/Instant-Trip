import { describe, it, expect } from "vitest";
import { checkOpenByDayAwareHours } from "@/lib/pipeline/availability";

describe("checkOpenByDayAwareHours", () => {
  it("요일별 다중 줄 — 매칭되는 요일 줄이 없으면 closed", () => {
    const usetime = "금요일 19:00~20:00\n토요일 10:00~11:00, 14:00~15:00";
    // 일요일(day=0) — 금/토 요일 정보만 있어 오늘 매칭 줄이 없다.
    expect(checkOpenByDayAwareHours(usetime, { day: 0, hour: 12, minute: 0 })).toBe(
      "closed",
    );
  });

  it("요일별 다중 줄 — 오늘(토요일) 매칭 줄의 시간대 안이면 open", () => {
    const usetime = "금요일 19:00~20:00\n토요일 10:00~11:00, 14:00~15:00";
    expect(
      checkOpenByDayAwareHours(usetime, { day: 6, hour: 10, minute: 30 }),
    ).toBe("open");
  });

  it("요일별 다중 줄 — 오늘(토요일) 매칭 줄의 시간대 밖이면 closed", () => {
    const usetime = "금요일 19:00~20:00\n토요일 10:00~11:00, 14:00~15:00";
    expect(
      checkOpenByDayAwareHours(usetime, { day: 6, hour: 12, minute: 0 }),
    ).toBe("closed");
  });

  it("요일 범위(월요일~목요일 / 금요일~일요일) — 금요일 20:00은 금~일 구간의 시간대로 open", () => {
    const usetime = "- 월요일~목요일 12:30~19:30\n- 금요일~일요일 12:30~20:30";
    expect(
      checkOpenByDayAwareHours(usetime, { day: 5, hour: 20, minute: 0 }),
    ).toBe("open");
  });

  it("요일 라벨 없는 단일 시간대 — 현재 시각이 범위 안이면 open", () => {
    expect(
      checkOpenByDayAwareHours("09:00~18:00", { day: 3, hour: 14, minute: 0 }),
    ).toBe("open");
  });

  it("요일·시간대 모두 없는 자유 텍스트는 unknown", () => {
    expect(
      checkOpenByDayAwareHours("상시 개방", { day: 3, hour: 14, minute: 0 }),
    ).toBe("unknown");
  });
});
