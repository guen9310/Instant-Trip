import { describe, it, expect } from "vitest";
import { formatDuration } from "@/shared/utils/duration";

describe("formatDuration", () => {
  it("60분 미만 범위는 분 단위로 표기한다", () => {
    expect(formatDuration({ min: 30, max: 50 })).toBe("30분~50분 정도");
  });

  it("60분 경계는 시간 단위로 표기한다", () => {
    expect(formatDuration({ min: 30, max: 60 })).toBe("30분~1시간 정도");
  });

  it("시간+분 혼합 렌더링", () => {
    expect(formatDuration({ min: 90, max: 150 })).toBe(
      "1시간 30분~2시간 30분 정도",
    );
  });

  it("정각 시간은 분을 생략한다", () => {
    expect(formatDuration({ min: 120, max: 240 })).toBe("2시간~4시간 정도");
  });

  it("min과 max가 같으면 단일 값으로 표기한다", () => {
    expect(formatDuration({ min: 60, max: 60 })).toBe("보통 1시간 정도");
    expect(formatDuration({ min: 40, max: 40 })).toBe("보통 40분 정도");
  });
});
