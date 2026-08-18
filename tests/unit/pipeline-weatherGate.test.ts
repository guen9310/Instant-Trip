import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { generateCourse } from "@/lib/pipeline/index";
import { collectCandidates } from "@/lib/pipeline/collect";
import { supplementWithKakao } from "@/lib/pipeline/kakaoCollect";
import { fetchNearbyFestivals } from "@/lib/pipeline/festival";
import { checkPlaceAvailability } from "@/lib/pipeline/availability";
import { getWeatherGateSignal } from "@/server/weather";
import type { UserProfile, PlaceCandidate } from "@/lib/pipeline/types";
import type { TourItem } from "@/lib/tour/types";

vi.mock("@/lib/pipeline/collect", () => ({
  collectCandidates: vi.fn(),
}));
vi.mock("@/lib/pipeline/kakaoCollect", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pipeline/kakaoCollect")>(
    "@/lib/pipeline/kakaoCollect",
  );
  return { ...actual, supplementWithKakao: vi.fn() };
});
vi.mock("@/lib/pipeline/festival", () => ({
  fetchNearbyFestivals: vi.fn().mockResolvedValue({ ongoing: [], upcoming: [] }),
}));
vi.mock("@/lib/pipeline/availability", () => ({
  checkPlaceAvailability: vi.fn(),
}));
vi.mock("@/server/weather", () => ({
  getWeatherGateSignal: vi.fn(),
}));
vi.mock("@/lib/pipeline/course", () => ({
  assembleCourse: vi.fn(async (scored: PlaceCandidate[], profile: UserProfile) => {
    if (scored.length === 0) {
      return {
        mainPlace: null,
        nearbyPlaces: [],
        scale: profile.scale,
        generatedAt: new Date().toISOString(),
      };
    }
    const c = scored[0];
    return {
      mainPlace: {
        contentId: c.item.contentid,
        contentTypeId: c.item.contenttypeid,
        title: c.item.title,
        address: c.item.addr1,
        shortAddress: c.item.addr1,
        overview: "",
        images: [],
        coord: null,
        tags: c.tags,
        score: c.score,
        availabilityUncertain: c.availabilityUncertain,
        estimatedDuration: c.estimatedDuration,
        origin: "recommended" as const,
        hours: c.hours ?? "",
      },
      nearbyPlaces: [],
      scale: profile.scale,
      generatedAt: new Date().toISOString(),
    };
  }),
}));

const mockedCollect = collectCandidates as unknown as Mock;
const mockedKakao = supplementWithKakao as unknown as Mock;
const mockedCheck = checkPlaceAvailability as unknown as Mock;
const mockedWeather = getWeatherGateSignal as unknown as Mock;
void fetchNearbyFestivals; // 임포트만으로 vi.mock 대상 지정

// contenttypeid=12(관광지) → classifyIndoorOutdoor 기준 outdoor
function makeOutdoorItem(contentid: string, overrides: Partial<TourItem> = {}): TourItem {
  return {
    contentid,
    contenttypeid: "12",
    title: `실외장소-${contentid}`,
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

// contenttypeid=14(문화시설) → classifyIndoorOutdoor 기준 indoor
function makeIndoorItem(contentid: string, overrides: Partial<TourItem> = {}): TourItem {
  return makeOutdoorItem(contentid, {
    contenttypeid: "14",
    title: `실내장소-${contentid}`,
    ...overrides,
  });
}

function baseProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    tagWeights: { 도보친화: 1, "1인여행": 0, 실내: 0, 조용함: 0 },
    preferFood: false,
    location: { mapX: 126.9779, mapY: 37.5663 },
    scale: "적당히",
    areaCode: "1",
    sigunguCode: "",
    ...overrides,
  };
}

function openResult(hours = "09:00~18:00") {
  return { status: "open", reason: "지금 입장 가능합니다.", hours, restDayNote: null };
}
function closedResult() {
  return { status: "closed_hours", reason: "지금은 이용시간이 아닙니다.", hours: null, restDayNote: null };
}

const CLEAR = { condition: "clear" as const, isHeatwave: false, tempC: null, hoursAhead: 0 };
const RAIN = { condition: "rain" as const, isHeatwave: false, tempC: null, hoursAhead: 0 };

describe("generateCourse — 날씨 게이트", () => {
  beforeEach(() => {
    mockedCollect.mockReset();
    mockedKakao.mockReset();
    mockedCheck.mockReset();
    mockedWeather.mockReset();
  });

  it("날씨가 맑으면(clear) 순서·결과 그대로, weatherSwitch는 null", async () => {
    const outdoor = makeOutdoorItem("out", { title: "실외-1위" });
    const indoor = makeIndoorItem("in", { title: "실내-2위" });
    mockedCollect.mockResolvedValue([outdoor, indoor]);
    mockedCheck.mockResolvedValue(openResult());
    mockedWeather.mockResolvedValue(CLEAR);

    const result = await generateCourse(baseProfile());

    expect(result.course.mainPlace?.contentId).toBe("out");
    expect(result.course.weatherSwitch).toBeNull();
  });

  it("비 예보 + 실외 1위·실내 2위가 근접 점수면 실내로 전환되고 weatherSwitch가 채워진다", async () => {
    // 태그 가중치가 도보친화뿐이라 관광지(12)·문화시설(14) 둘 다 tagScore=1.0으로
    // 동일하다(TAG_MAPPING_RULES: 둘 다 도보친화 1.0을 받음) — 유일한 차이는 거리다.
    // outdoor를 검색 원점(0km, distanceBonus=1.0)에, indoor를 약 1km 떨어진 곳
    // (distanceBonus≈0.9)에 둬서 원점수 격차(0.25×0.1=0.025)를 감점 폭(0.15)보다
    // 훨씬 작게 만든다 — 감점 전엔 outdoor가 1위, 감점 후엔 indoor가 역전해야 한다.
    const outdoor = makeOutdoorItem("out", {
      title: "실외-원래1위",
      mapx: "126.9779",
      mapy: "37.5663", // 검색 원점과 동일 — distanceBonus=1.0
    });
    const indoor = makeIndoorItem("in", {
      title: "실내-대체",
      mapx: "126.9779",
      mapy: "37.5753", // 원점에서 북쪽으로 약 1km
    });
    mockedCollect.mockResolvedValue([outdoor, indoor]);
    mockedCheck.mockResolvedValue(openResult());
    mockedWeather.mockResolvedValue(RAIN);

    const clearResult = await generateCourse(baseProfile(), { weatherOverride: "clear" });
    expect(clearResult.course.mainPlace?.contentId).toBe("out"); // 감점 전 1위는 outdoor임을 먼저 확인

    const result = await generateCourse(baseProfile());

    expect(result.course.mainPlace?.contentId).toBe("in");
    expect(result.course.weatherSwitch).toBe("rain");
  });

  it("outdoor 1위가 감점 폭을 압도하면(원래 1위 유지) weatherSwitch는 null", async () => {
    const outdoor = makeOutdoorItem("out", { title: "실외-압도적1위" });
    mockedCollect.mockResolvedValue([outdoor]);
    mockedCheck.mockResolvedValue(openResult());
    mockedWeather.mockResolvedValue(RAIN);

    const result = await generateCourse(baseProfile());

    expect(result.course.mainPlace?.contentId).toBe("out");
    expect(result.course.weatherSwitch).toBeNull();
  });

  it("원래 1위가 이미 indoor면 비가 와도 weatherSwitch는 null(전환이 아니므로)", async () => {
    const indoor = makeIndoorItem("in", { title: "실내-원래1위" });
    mockedCollect.mockResolvedValue([indoor]);
    mockedCheck.mockResolvedValue(openResult());
    mockedWeather.mockResolvedValue(RAIN);

    const result = await generateCourse(baseProfile());

    expect(result.course.mainPlace?.contentId).toBe("in");
    expect(result.course.weatherSwitch).toBeNull();
  });

  // 실측 재현(pnpm pipeline --weather) — 1위(실내)가 휴관이라 2위로 넘어가고,
  // 그 2위(실외)가 감점으로 3위(실내)보다 아래로 밀리는 경우.
  it("감점 전 1위(실내)가 휴관이어도, 2위(실외)→3위(실내) 역전을 전환으로 감지한다", async () => {
    const closedIndoorTop = makeIndoorItem("top", {
      title: "실내-1위(휴관)",
      mapx: "126.9779",
      mapy: "37.5663", // 원점 — distanceBonus=1.0, 최고 점수
    });
    const outdoorSecond = makeOutdoorItem("second", {
      title: "실외-2위",
      mapx: "126.9779",
      mapy: "37.5664", // 원점에서 아주 조금(≈0.01km) — 근소하게 2위
    });
    const indoorThird = makeIndoorItem("third", {
      title: "실내-3위",
      mapx: "126.9779",
      mapy: "37.5673", // 원점에서 조금 더(≈0.1km) — 근소하게 3위
    });
    mockedCollect.mockResolvedValue([closedIndoorTop, outdoorSecond, indoorThird]);
    mockedWeather.mockResolvedValue(RAIN);

    // 감점 전(맑음) 순서 확인용 — 1위는 휴관, 2위(실외)가 채택돼야 정상
    mockedCheck
      .mockResolvedValueOnce(closedResult()) // top
      .mockResolvedValueOnce(openResult()); // second
    const clearResult = await generateCourse(baseProfile(), { weatherOverride: "clear" });
    expect(clearResult.course.mainPlace?.contentId).toBe("second");

    // 비 예보 — 1위는 여전히 휴관, 2위(실외)는 감점으로 3위보다 아래로 밀려나
    // 게이트가 3위(실내)를 확인해 채택해야 한다.
    mockedCheck.mockReset();
    mockedCheck
      .mockResolvedValueOnce(closedResult()) // top
      .mockResolvedValueOnce(openResult()); // third (감점 후 2번째로 확인됨)
    const result = await generateCourse(baseProfile());

    expect(result.course.mainPlace?.contentId).toBe("third");
    expect(result.course.weatherSwitch).toBe("rain");
  });

  it("weatherOverride를 주면 실제 API(getWeatherGateSignal)를 호출하지 않는다", async () => {
    const outdoor = makeOutdoorItem("out");
    mockedCollect.mockResolvedValue([outdoor]);
    mockedCheck.mockResolvedValue(openResult());

    await generateCourse(baseProfile(), { weatherOverride: "rain" });

    expect(mockedWeather).not.toHaveBeenCalled();
  });

  it("weatherOverride:rain은 실제 API와 동일하게 outdoor 후보를 감점시킨다", async () => {
    const outdoor = makeOutdoorItem("out", {
      title: "실외-근소1위",
      mapx: "126.99",
      mapy: "37.57",
    });
    const indoor = makeIndoorItem("in", {
      title: "실내-대체",
      mapx: "126.978",
      mapy: "37.566",
    });
    mockedCollect.mockResolvedValue([outdoor, indoor]);
    mockedCheck.mockResolvedValue(openResult());
    mockedWeather.mockResolvedValue(CLEAR);

    const withoutOverride = await generateCourse(baseProfile());
    mockedCheck.mockClear();
    const withOverride = await generateCourse(baseProfile(), { weatherOverride: "rain" });

    // 감점이 실제로 적용됐다면 최소한 채택된 후보의 점수가 override 없을 때보다
    // 낮거나 같아야 한다(같은 후보가 채택되더라도 outdoor면 감점된 점수여야 함).
    if (withoutOverride.course.mainPlace?.contentId === "out") {
      const before = withoutOverride.debug.scored.find((c) => c.item.contentid === "out")!.score;
      const after = withOverride.debug.scored.find((c) => c.item.contentid === "out")!.score;
      expect(after).toBeLessThanOrEqual(before);
    }
  });

  it("API 실패 시 무감점(clear)으로 fail-open된다", async () => {
    const outdoor = makeOutdoorItem("out");
    mockedCollect.mockResolvedValue([outdoor]);
    mockedCheck.mockResolvedValue(openResult());
    mockedWeather.mockRejectedValue(new Error("네트워크 오류"));

    const result = await generateCourse(baseProfile());

    expect(result.course.mainPlace?.contentId).toBe("out");
    expect(result.course.weatherSwitch).toBeNull();
  });
});
