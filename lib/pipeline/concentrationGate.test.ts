import { describe, it, expect } from "vitest";
import { deriveConcentrationSwitchReason } from "@/lib/pipeline/concentrationGate";
import { normalizeName } from "@/lib/clients/tatsCnctrRate";

describe("deriveConcentrationSwitchReason — 배너 노출 판정", () => {
  it("quiet 방향 + 한산함(50% 미만) → quiet 배너", () => {
    expect(deriveConcentrationSwitchReason("quiet", 30)).toBe("quiet");
  });

  it("quiet 방향 + 붐빔(50% 이상) → 모순이므로 null", () => {
    expect(deriveConcentrationSwitchReason("quiet", 70)).toBeNull();
  });

  it("lively 방향 + 붐빔(50% 이상) → lively 배너", () => {
    expect(deriveConcentrationSwitchReason("lively", 80)).toBe("lively");
  });

  it("lively 방향 + 한산함(50% 미만) → 모순이므로 null", () => {
    expect(deriveConcentrationSwitchReason("lively", 20)).toBeNull();
  });

  it("경계값 50 → lively는 붐빔으로 처리되어 배너 노출", () => {
    expect(deriveConcentrationSwitchReason("lively", 50)).toBe("lively");
  });

  it("경계값 50 → quiet는 한산함 기준(50 미만)에 못 들어 null", () => {
    expect(deriveConcentrationSwitchReason("quiet", 50)).toBeNull();
  });

  it("매칭 안 됨(null/undefined) → 항상 null", () => {
    expect(deriveConcentrationSwitchReason("quiet", null)).toBeNull();
    expect(deriveConcentrationSwitchReason("lively", undefined)).toBeNull();
  });
});

describe("normalizeName — 공백/괄호 접미사 정규화", () => {
  it("공백을 제거한다", () => {
    expect(normalizeName("동네 책방 스몰굿씽")).toBe("동네책방스몰굿씽");
  });

  it("괄호 접미사를 제거한다", () => {
    expect(normalizeName("영천사(원주)")).toBe("영천사");
  });

  it("공백과 괄호가 함께 있어도 둘 다 제거한다", () => {
    expect(normalizeName("봉산동 당간지주 (원주)")).toBe("봉산동당간지주");
  });
});
