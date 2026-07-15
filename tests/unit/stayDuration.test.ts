import { describe, it, expect } from "vitest";
import {
  estimateStayDuration,
  matchStayDurationRule,
  STAY_DURATION_TABLE,
  STAY_DURATION_DEFAULT,
  STAY_DURATION_DEFAULT_KEY,
} from "@/lib/pipeline/stayDuration";

describe("STAY_DURATION_TABLE 불변식", () => {
  it("모든 규칙의 범위는 0 < min <= max", () => {
    for (const rule of [...STAY_DURATION_TABLE.map((r) => r.range), STAY_DURATION_DEFAULT]) {
      expect(rule.min).toBeGreaterThan(0);
      expect(rule.min).toBeLessThanOrEqual(rule.max);
    }
  });

  it("규칙 key는 중복되지 않는다 (실측 통계 조인 키)", () => {
    const keys = STAY_DURATION_TABLE.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("estimateStayDuration 우선순위", () => {
  it("kakao 출처는 lclsSystm 규칙보다 먼저 평가된다", () => {
    // kakaoCategory AT4 + 전시시설 코드가 동시에 있으면 kakao 규칙이 이긴다
    const dur = estimateStayDuration({
      source: "kakao",
      kakaoCategory: "AT4",
      lclsSystm2: "VE07",
    });
    expect(dur).toEqual({ min: 30, max: 60 });
  });

  it("세부 코드(VE010200 전망대)가 상위 코드(NA 자연관광)보다 이긴다", () => {
    const dur = estimateStayDuration({
      lclsSystm1: "NA",
      lclsSystm3: "VE010200",
    });
    expect(dur).toEqual({ min: 30, max: 60 });
  });

  it("캠핑(AC05)이 자연관광(NA)보다 이긴다", () => {
    const dur = estimateStayDuration({
      lclsSystm1: "NA",
      lclsSystm2: "AC05",
    });
    expect(dur).toEqual({ min: 60, max: 120 });
  });

  it("kakao 출처라도 AT4/CT1 외 카테고리는 default로 떨어진다", () => {
    const dur = estimateStayDuration({ source: "kakao", kakaoCategory: "FD6" });
    expect(dur).toEqual(STAY_DURATION_DEFAULT);
  });
});

describe("estimateStayDuration fallback", () => {
  it("빈 입력은 default 범위를 반환한다", () => {
    expect(estimateStayDuration({})).toEqual(STAY_DURATION_DEFAULT);
  });

  it("미매칭 코드(역사유적 HS 등)는 default 범위를 반환한다", () => {
    expect(estimateStayDuration({ lclsSystm1: "HS" })).toEqual(
      STAY_DURATION_DEFAULT,
    );
  });

  it("테마공원(VE02)은 반나절 단위 범위", () => {
    expect(estimateStayDuration({ lclsSystm2: "VE02" })).toEqual({
      min: 150,
      max: 240,
    });
  });
});

describe("matchStayDurationRule — 실측 집계 조인 키", () => {
  it("매칭된 규칙의 key를 함께 반환한다", () => {
    const r = matchStayDurationRule({ source: "kakao", kakaoCategory: "AT4" });
    expect(r.key).toBe("kakao:AT4");
    expect(r.range).toEqual({ min: 30, max: 60 });
  });

  it("미매칭은 default key를 반환한다", () => {
    const r = matchStayDurationRule({});
    expect(r.key).toBe(STAY_DURATION_DEFAULT_KEY);
    expect(r.range).toEqual(STAY_DURATION_DEFAULT);
  });

  it("estimateStayDuration은 matchStayDurationRule의 range와 항상 일치한다", () => {
    const inputs = [
      {},
      { lclsSystm1: "NA" },
      { lclsSystm2: "VE07" },
      { source: "kakao" as const, kakaoCategory: "CT1" },
    ];
    for (const input of inputs) {
      expect(estimateStayDuration(input)).toEqual(
        matchStayDurationRule(input).range,
      );
    }
  });
});
