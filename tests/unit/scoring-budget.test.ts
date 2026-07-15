import { describe, it, expect } from "vitest";
import { calcBudgetFitness } from "@/lib/pipeline/scoring";

describe("calcBudgetFitness — 범위 중앙값 기준", () => {
  it("중앙값이 예산 이내면 1.0", () => {
    // {30,60} mid 45 <= 60
    expect(calcBudgetFitness({ min: 30, max: 60 }, 60)).toBe(1.0);
  });

  it("중앙값이 예산과 정확히 같으면 1.0 (경계)", () => {
    // {40,80} mid 60 === 60
    expect(calcBudgetFitness({ min: 40, max: 80 }, 60)).toBe(1.0);
  });

  it("초과분만큼 선형 감쇠한다", () => {
    // {60,120} mid 90, budget 60 → 1 - 30/60 = 0.5
    expect(calcBudgetFitness({ min: 60, max: 120 }, 60)).toBeCloseTo(0.5);
  });

  it("예산의 2배 이상이면 0으로 바닥친다", () => {
    // {150,240} mid 195, budget 60 → 1 - 135/60 < 0 → 0
    expect(calcBudgetFitness({ min: 150, max: 240 }, 60)).toBe(0);
  });

  it("구 max 기준 대비 완화 — 기본값 장소가 '가볍게'에서 덜 감점된다", () => {
    // default {60,120}: 구 방식은 max 120 기준 → 0, 신 방식은 mid 90 → 0.5
    expect(calcBudgetFitness({ min: 60, max: 120 }, 60)).toBeGreaterThan(0);
  });
});
