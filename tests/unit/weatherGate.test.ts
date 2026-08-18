import { describe, it, expect } from "vitest";
import {
  applyWeatherGate,
  findDemotedOutdoorCandidate,
  WEATHER_PENALTY,
} from "@/lib/pipeline/weatherGate";
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

describe("findDemotedOutdoorCandidate", () => {
  // 1위(indoor)는 그대로 두고, 2위(outdoor)가 감점으로 3위(indoor)보다 아래로
  // 밀려나는 상황(실측 재현).
  it("winner보다 위였던 실외 후보가 감점으로 winner보다 아래로 밀리면 그 후보를 반환한다", () => {
    const top = makeCandidate("top", 0.9, { contenttypeid: "14" }); // indoor, 그대로 1위
    const outdoor = makeCandidate("outdoor", 0.7); // 관광지 → outdoor, 감점 전 2위
    const winner = makeCandidate("winner", 0.6, { contenttypeid: "14" }); // indoor, 감점 전 3위
    const preScored = [top, outdoor, winner]; // 감점 전 순위
    // outdoor에 0.15 감점 적용 → 0.55, winner(0.6)보다 아래로 밀림
    const postScored = [top, winner, { ...outdoor, score: 0.55 }];

    const demoted = findDemotedOutdoorCandidate(preScored, postScored, winner);
    expect(demoted?.item.contentid).toBe("outdoor");
  });

  it("winner가 감점 전 1위면(위에 아무도 없으면) null", () => {
    const winner = makeCandidate("winner", 0.9, { contenttypeid: "14" });
    const outdoor = makeCandidate("outdoor", 0.5);
    const preScored = [winner, outdoor];
    const postScored = [winner, { ...outdoor, score: 0.35 }];

    expect(findDemotedOutdoorCandidate(preScored, postScored, winner)).toBeNull();
  });

  it("winner 위에 있던 실외 후보가 감점 후에도 winner보다 여전히 위면 null", () => {
    const outdoor = makeCandidate("outdoor", 0.9); // 감점(0.15) 후에도 0.75로 여전히 위
    const winner = makeCandidate("winner", 0.6, { contenttypeid: "14" });
    const preScored = [outdoor, winner];
    const postScored = [{ ...outdoor, score: 0.75 }, winner];

    expect(findDemotedOutdoorCandidate(preScored, postScored, winner)).toBeNull();
  });

  it("winner 위에 있던 후보가 실내면(실외가 아니면) 무시한다", () => {
    const indoorAbove = makeCandidate("indoor-above", 0.9, { contenttypeid: "14" });
    const winner = makeCandidate("winner", 0.6, { contenttypeid: "14" });
    const preScored = [indoorAbove, winner];
    // indoor는 감점 대상이 아니므로 순서가 안 바뀌어야 정상이지만, 혹시 바뀌어도
    // outdoor가 아니므로 무시돼야 한다.
    const postScored = [winner, indoorAbove];

    expect(findDemotedOutdoorCandidate(preScored, postScored, winner)).toBeNull();
  });
});
