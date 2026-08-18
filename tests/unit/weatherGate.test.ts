import { describe, it, expect } from "vitest";
import { applyWeatherGate, WEATHER_PENALTY } from "@/lib/pipeline/weatherGate";
import type { PlaceCandidate } from "@/lib/pipeline/types";
import type { TourItem } from "@/lib/tour/types";
import type { WeatherGateSignal } from "@/shared/utils/weatherContext";

function makeItem(contentid: string, overrides: Partial<TourItem> = {}): TourItem {
  return {
    contentid,
    contenttypeid: "12", // outdoor 기본값(관광지)
    title: `장소-${contentid}`,
    addr1: "서울",
    addr2: "",
    mapx: "126.98",
    mapy: "37.56",
    firstimage: "",
    firstimage2: "",
    areacode: "1",
    sigungucode: "",
    createdtime: "",
    modifiedtime: "",
    tel: "",
    ...overrides,
  };
}

function makeCandidate(
  contentid: string,
  score: number,
  itemOverrides: Partial<TourItem> = {},
): PlaceCandidate {
  return {
    item: makeItem(contentid, itemOverrides),
    tagScores: { 도보친화: 0, "1인여행": 0, 실내: 0, 조용함: 0 },
    tags: [],
    score,
    available: true,
    availabilityUncertain: false,
    estimatedDuration: { min: 60, max: 120 },
  };
}

function signal(overrides: Partial<WeatherGateSignal> = {}): WeatherGateSignal {
  return { condition: "clear", isHeatwave: false, tempC: null, hoursAhead: 0, ...overrides };
}

describe("applyWeatherGate", () => {
  it("clear면 무변경 — reason null, 순서·원본 배열 그대로", () => {
    const outdoor = makeCandidate("1", 0.5);
    const indoor = makeCandidate("2", 0.3, { contenttypeid: "14" });
    const scored = [outdoor, indoor];
    const result = applyWeatherGate(scored, signal());

    expect(result.reason).toBeNull();
    expect(result.penalizedCount).toBe(0);
    expect(result.scored).toBe(scored); // 동일 참조 — 새로 만들지 않음
    expect(result.scored.map((c) => c.item.contentid)).toEqual(["1", "2"]);
  });

  it("rain이면 outdoor만 감점하고 재정렬한다 — indoor는 그대로", () => {
    const outdoor = makeCandidate("1", 0.5); // 관광지(12) → outdoor
    const indoor = makeCandidate("2", 0.4, { contenttypeid: "14" }); // 문화시설 → indoor
    const result = applyWeatherGate([outdoor, indoor], signal({ condition: "rain" }));

    expect(result.reason).toBe("rain");
    expect(result.penalizedCount).toBe(1);
    // outdoor: 0.5 - 0.15 = 0.35 < indoor 0.4 → 순위 역전
    expect(result.scored.map((c) => c.item.contentid)).toEqual(["2", "1"]);
    expect(result.scored.find((c) => c.item.contentid === "1")!.score).toBeCloseTo(0.35);
    expect(result.scored.find((c) => c.item.contentid === "2")!.score).toBe(0.4);
  });

  it("감점 후 점수가 음수로 내려가지 않는다", () => {
    const outdoor = makeCandidate("1", 0.1);
    const result = applyWeatherGate([outdoor], signal({ condition: "rain" }));
    expect(result.scored[0].score).toBe(0);
  });

  it("outdoor 1위가 감점 폭을 압도하면 순위가 그대로 유지된다(소프트 감점)", () => {
    const outdoor = makeCandidate("1", 0.9);
    const indoor = makeCandidate("2", 0.3, { contenttypeid: "14" });
    const result = applyWeatherGate([outdoor, indoor], signal({ condition: "rain" }));
    expect(result.scored.map((c) => c.item.contentid)).toEqual(["1", "2"]);
  });

  it("snow/heatwave 계수가 조건별로 다르게 적용된다", () => {
    const item = makeCandidate("1", 0.5);
    const rain = applyWeatherGate([item], signal({ condition: "rain" }));
    const snow = applyWeatherGate([item], signal({ condition: "snow" }));
    const heatwave = applyWeatherGate([item], signal({ condition: "clear", isHeatwave: true }));

    expect(rain.scored[0].score).toBeCloseTo(0.5 - WEATHER_PENALTY.rain);
    expect(snow.scored[0].score).toBeCloseTo(0.5 - WEATHER_PENALTY.snow);
    expect(heatwave.scored[0].score).toBeCloseTo(0.5 - WEATHER_PENALTY.heatwave);
    expect(WEATHER_PENALTY.snow).toBeGreaterThan(WEATHER_PENALTY.rain);
    expect(WEATHER_PENALTY.rain).toBeGreaterThan(WEATHER_PENALTY.heatwave);
  });

  it("snow 조건이 heatwave보다 우선한다(둘 다 참이어도 reason=snow)", () => {
    const item = makeCandidate("1", 0.5);
    const result = applyWeatherGate([item], signal({ condition: "snow", isHeatwave: true }));
    expect(result.reason).toBe("snow");
  });
});
