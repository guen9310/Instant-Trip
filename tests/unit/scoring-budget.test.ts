import { describe, it, expect } from "vitest";
import { calcBudgetFitness } from "@/lib/pipeline/scoring";

describe("calcBudgetFitness — 예산의 75%를 목표치로 하는 봉우리형 함수", () => {
  it("중앙값이 목표치(예산×0.75)와 정확히 같으면 1.0", () => {
    // budget 60 → target 45, {30,60} mid 45
    expect(calcBudgetFitness({ min: 30, max: 60 }, 60)).toBe(1.0);
  });

  it("목표치보다 짧아도 감점된다(봉우리형 — 짧은 쪽)", () => {
    // budget 60 → target 45, mid 0 → |0-45|/45 = 1 → 0
    expect(calcBudgetFitness({ min: 0, max: 0 }, 60)).toBe(0);
  });

  it("목표치보다 길어도 감점된다(봉우리형 — 긴 쪽)", () => {
    // budget 60 → target 45, {40,80} mid 60 → 1 - 15/45 ≈ 0.667
    expect(calcBudgetFitness({ min: 40, max: 80 }, 60)).toBeCloseTo(0.667, 2);
  });

  it("목표치의 2배 이상 벗어나면 0으로 바닥친다", () => {
    // budget 60 → target 45, {150,240} mid 195 → |195-45|/45 > 1 → 0
    expect(calcBudgetFitness({ min: 150, max: 240 }, 60)).toBe(0);
  });

  it("같은 중앙값이라도 예산(scale)이 커지면 적합도가 달라진다 — scale별 다양성의 근거", () => {
    const short = { min: 30, max: 60 }; // mid 45
    const light = calcBudgetFitness(short, 60); // target 45 → 정확히 일치
    const leisurely = calcBudgetFitness(short, 240); // target 180 → 한참 못 미침
    expect(leisurely).toBeLessThan(light);
  });

  it("예산이 정확히 배수 관계(적당히 120 vs 여유롭게 240)여도 후보 간 순위가 뒤집힐 수 있다", () => {
    // 순수 비율(mid/budget) 방식의 실패 지점을 그대로 재현 — 두 방식 다 "예산 이내는
    // 균일하게 스케일"되면 순위가 절대 안 바뀄던 버그를 봉우리형으로 고쳤는지 검증.
    const short = { min: 30, max: 60 }; // mid 45 — 짧은 장소(도시공원 등)
    const long = { min: 120, max: 180 }; // mid 150 — 긴 장소(테마공원급)

    const moderateShort = calcBudgetFitness(short, 120);
    const moderateLong = calcBudgetFitness(long, 120);
    expect(moderateShort).toBeGreaterThan(moderateLong); // 적당히엔 짧은 쪽이 유리

    const leisurelyShort = calcBudgetFitness(short, 240);
    const leisurelyLong = calcBudgetFitness(long, 240);
    expect(leisurelyLong).toBeGreaterThan(leisurelyShort); // 여유롭게엔 긴 쪽이 유리 — 순위 반전
  });
});
