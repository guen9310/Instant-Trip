import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { generateCourse } from "@/lib/pipeline/index";
import { collectCandidates } from "@/lib/pipeline/collect";
import { supplementWithKakao } from "@/lib/pipeline/kakaoCollect";
import { fetchNearbyFestivals } from "@/lib/pipeline/festival";
import { checkPlaceAvailability } from "@/lib/pipeline/availability";
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
void fetchNearbyFestivals; // 임포트만으로 vi.mock 대상 지정 — 직접 호출은 하지 않음

function makeItem(contentid: string, overrides: Partial<TourItem> = {}): TourItem {
  return {
    contentid,
    contenttypeid: "12",
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

describe("generateCourse — stage2/4 순서 반전", () => {
  beforeEach(() => {
    mockedCollect.mockReset();
    mockedKakao.mockReset();
    mockedCheck.mockReset();
  });

  it("excludeIds에 포함된 후보는 게이트 단계에서 절대 호출되지 않는다", async () => {
    const itemA = makeItem("A");
    const itemB = makeItem("B");
    mockedCollect.mockResolvedValue([itemA, itemB]);
    mockedCheck.mockResolvedValue(openResult());

    await generateCourse(baseProfile(), { excludeIds: ["A"] });

    const calledIds = mockedCheck.mock.calls.map((call) => call[0].contentid);
    expect(calledIds).not.toContain("A");
    expect(calledIds).toContain("B");
  });

  it("stage3.5 트리거가 가용성 통과분이 아니라 원본 수집 건수(items.length) 기준으로 호출된다", async () => {
    const items = Array.from({ length: 4 }, (_, i) => makeItem(`t${i}`)); // 4건 < KAKAO_SUPPLEMENT_MIN(5)
    mockedCollect.mockResolvedValue(items);
    mockedKakao.mockResolvedValue(items); // 보충 없이 그대로 반환해도 무방
    mockedCheck.mockResolvedValue(openResult());

    await generateCourse(baseProfile({ scale: "가볍게" }));

    expect(mockedKakao).toHaveBeenCalledTimes(1);
    const [firstArg] = mockedKakao.mock.calls[0];
    expect(firstArg).toEqual(items); // items(원본), available이 아님
  });

  it("수집 건수가 충분하면(≥5) 카카오 보충이 발동하지 않는다 — 가용성과 무관", async () => {
    const items = Array.from({ length: 6 }, (_, i) => makeItem(`t${i}`));
    mockedCollect.mockResolvedValue(items);
    mockedCheck.mockResolvedValue(openResult());

    await generateCourse(baseProfile({ scale: "가볍게" }));

    expect(mockedKakao).not.toHaveBeenCalled();
  });

  it("점수 1위가 열려있으면 그대로 메인 장소가 된다", async () => {
    // 도보친화 가중치만 있으므로 관광지(12)가 문화시설(14)보다 태그 점수가 높다
    const itemHigh = makeItem("high", { contenttypeid: "12" });
    const itemLow = makeItem("low", { contenttypeid: "28" });
    mockedCollect.mockResolvedValue([itemLow, itemHigh]);
    mockedCheck.mockResolvedValue(openResult());

    const result = await generateCourse(baseProfile());

    expect(result.course.mainPlace?.contentId).toBe("high");
    expect(mockedCheck).toHaveBeenCalledTimes(1);
  });

  it("점수 1위가 닫혀있으면 2위가 메인 장소가 되고, 1위→2위 순서로 정확히 2번 호출된다", async () => {
    const itemHigh = makeItem("high", { contenttypeid: "12" });
    const itemLow = makeItem("low", { contenttypeid: "28" });
    mockedCollect.mockResolvedValue([itemLow, itemHigh]);
    mockedCheck
      .mockResolvedValueOnce(closedResult()) // high
      .mockResolvedValueOnce(openResult()); // low

    const result = await generateCourse(baseProfile());

    expect(result.course.mainPlace?.contentId).toBe("low");
    expect(mockedCheck).toHaveBeenCalledTimes(2);
    expect(mockedCheck.mock.calls[0][0].contentid).toBe("high");
    expect(mockedCheck.mock.calls[1][0].contentid).toBe("low");
  });

  it("nearbyPlaces는 항상 빈 배열이다", async () => {
    mockedCollect.mockResolvedValue([makeItem("a"), makeItem("b")]);
    mockedCheck.mockResolvedValue(openResult());

    const result = await generateCourse(baseProfile());

    expect(result.course.nearbyPlaces).toEqual([]);
  });

  it("excludeCoords와 좌표가 일치하는(반올림 5자리) 후보는 게이트 이전에 제외된다", async () => {
    const visited = makeItem("visited", { mapx: "126.98000", mapy: "37.56000" });
    const fresh = makeItem("fresh", { mapx: "126.90000", mapy: "37.50000" });
    mockedCollect.mockResolvedValue([visited, fresh]);
    mockedCheck.mockResolvedValue(openResult());

    const result = await generateCourse(baseProfile(), {
      excludeCoords: [{ lat: 37.56, lng: 126.98 }],
    });

    const calledIds = mockedCheck.mock.calls.map((call) => call[0].contentid);
    expect(calledIds).not.toContain("visited");
    expect(result.course.mainPlace?.contentId).toBe("fresh");
  });

  it("maxDistanceKm보다 먼 후보는 제외된다", async () => {
    // baseProfile 위치: (37.5663, 126.9779)
    const near = makeItem("near", { mapx: "126.98", mapy: "37.57" }); // ~0.5km
    const far = makeItem("far", { mapx: "127.2", mapy: "37.7" }); // ~24km
    mockedCollect.mockResolvedValue([near, far]);
    mockedCheck.mockResolvedValue(openResult());

    const result = await generateCourse(baseProfile(), { maxDistanceKm: 10 });

    const calledIds = mockedCheck.mock.calls.map((call) => call[0].contentid);
    expect(calledIds).not.toContain("far");
    expect(result.course.mainPlace?.contentId).toBe("near");
  });

  it("excludeCoords가 후보 전체를 비우면 쿨다운을 무시하고 원래 풀로 폴백한다", async () => {
    const onlyOption = makeItem("only", { mapx: "126.98000", mapy: "37.56000" });
    mockedCollect.mockResolvedValue([onlyOption]);
    mockedCheck.mockResolvedValue(openResult());

    const result = await generateCourse(baseProfile(), {
      excludeCoords: [{ lat: 37.56, lng: 126.98 }], // onlyOption과 정확히 일치
    });

    // 쿨다운을 그대로 적용하면 0건이라 조건을 접고 onlyOption을 그대로 채택한다
    expect(result.course.mainPlace?.contentId).toBe("only");
  });

  it("maxDistanceKm이 후보 전체를 비우면(거절한 곳이 최근접) 거리 제약 없이 폴백한다", async () => {
    // baseProfile 위치: (37.5663, 126.9779) — far가 유일한 후보이고 rejectedDistanceKm보다 멀다
    const far = makeItem("far", { mapx: "127.2", mapy: "37.7" }); // ~24km
    mockedCollect.mockResolvedValue([far]);
    mockedCheck.mockResolvedValue(openResult());

    const result = await generateCourse(baseProfile(), { maxDistanceKm: 1 }); // far 혼자라 무조건 초과

    expect(result.course.mainPlace?.contentId).toBe("far");
  });
});
