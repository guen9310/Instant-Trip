import { describe, it, expect } from "vitest";
import { parseKstDateTime } from "@/shared/utils/kst";

describe("parseKstDateTime", () => {
  it("KST 15:00을 UTC 06:00으로 변환한다", () => {
    const d = parseKstDateTime("20260809", "1500");
    expect(d.toISOString()).toBe("2026-08-09T06:00:00.000Z");
  });

  it("KST 자정 근처 날짜 경계를 올바르게 넘긴다", () => {
    // KST 00:30 = 전날 UTC 15:30
    const d = parseKstDateTime("20260810", "0030");
    expect(d.toISOString()).toBe("2026-08-09T15:30:00.000Z");
  });
});
