import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { checkPlaceAvailability } from "@/lib/pipeline/availability";
import { selectAvailableCandidate } from "@/lib/pipeline/availabilityGate";
import type { PlaceCandidate } from "@/lib/pipeline/types";
import type { TourItem } from "@/lib/tour/types";

vi.mock("@/lib/pipeline/availability", () => ({
  checkPlaceAvailability: vi.fn(),
}));

const mockedCheck = checkPlaceAvailability as unknown as Mock;

function makeCandidate(
  contentid: string,
  score: number,
  overrides: Partial<TourItem> = {},
): PlaceCandidate {
  const item: TourItem = {
    contentid,
    contenttypeid: "12",
    title: `장소-${contentid}`,
    addr1: "서울",
    addr2: "",
    mapx: "126.9",
    mapy: "37.5",
    firstimage: "",
    firstimage2: "",
    areacode: "1",
    sigungucode: "",
    createdtime: "",
    modifiedtime: "",
    tel: "",
    ...overrides,
  };
  return {
    item,
    tagScores: { 도보친화: 0, "1인여행": 0, 실내: 0, 조용함: 0 },
    tags: [],
    score,
    available: true,
    availabilityUncertain: false,
    estimatedDuration: { min: 30, max: 60 },
  };
}

function openResult(hours = "09:00~18:00") {
  return { status: "open", reason: "지금 입장 가능합니다.", hours, restDayNote: null };
}
function closedResult() {
  return { status: "closed_hours", reason: "지금은 이용시간이 아닙니다.", hours: null, restDayNote: null };
}
function uncertainOpenResult() {
  return { status: "uncertain", reason: "운영시간 조회 중 오류가 발생했습니다.", hours: null, restDayNote: null };
}

describe("selectAvailableCandidate", () => {
  beforeEach(() => {
    mockedCheck.mockReset();
  });

  it("점수 순서대로 순차 확인하고, 열린 곳을 찾으면 즉시 멈춘다", async () => {
    const c1 = makeCandidate("1", 0.9);
    const c2 = makeCandidate("2", 0.8);
    const c3 = makeCandidate("3", 0.7);
    mockedCheck
      .mockResolvedValueOnce(closedResult())
      .mockResolvedValueOnce(openResult());

    const result = await selectAvailableCandidate([c1, c2, c3]);

    expect(result?.winner.item.contentid).toBe("2");
    expect(result?.exhausted).toBe(false);
    expect(mockedCheck).toHaveBeenCalledTimes(2);
    expect(mockedCheck.mock.calls[0][0].contentid).toBe("1");
    expect(mockedCheck.mock.calls[1][0].contentid).toBe("2");
  });

  it("Kakao 후보는 검사 없이 즉시 채택한다", async () => {
    const c1 = makeCandidate("1", 0.9, { source: "tour" });
    const c2 = makeCandidate("2", 0.8, { source: "kakao" });
    mockedCheck.mockResolvedValueOnce(closedResult());

    const result = await selectAvailableCandidate([c1, c2]);

    expect(result?.winner.item.contentid).toBe("2");
    expect(result?.checksPerformed).toBe(1); // c1만 카운트, c2는 검사 안 함
    expect(mockedCheck).toHaveBeenCalledTimes(1);
  });

  it("Kakao가 1위면 tour 후보는 아예 확인하지 않는다", async () => {
    const c1 = makeCandidate("1", 0.9, { source: "kakao" });
    const c2 = makeCandidate("2", 0.8, { source: "tour" });

    const result = await selectAvailableCandidate([c1, c2]);

    expect(result?.winner.item.contentid).toBe("1");
    expect(mockedCheck).not.toHaveBeenCalled();
  });

  it("상한을 소진하면 1위를 폴백으로 채택하고 uncertain=true로 표시한다", async () => {
    const candidates = Array.from({ length: 5 }, (_, i) =>
      makeCandidate(String(i + 1), 1 - i * 0.1),
    );
    mockedCheck.mockResolvedValue(closedResult());

    const result = await selectAvailableCandidate(candidates, { maxChecks: 2 });

    expect(result?.checksPerformed).toBe(2);
    expect(result?.exhausted).toBe(true);
    expect(result?.winner.item.contentid).toBe("1");
    expect(result?.winner.availabilityUncertain).toBe(true);
    expect(mockedCheck).toHaveBeenCalledTimes(2);
  });

  it("상한 도달 전에 후보 자체가 소진되면(전부 closed) 1위로 폴백한다", async () => {
    const candidates = Array.from({ length: 3 }, (_, i) =>
      makeCandidate(String(i + 1), 1 - i * 0.1),
    );
    mockedCheck.mockResolvedValue(closedResult());

    const result = await selectAvailableCandidate(candidates, { maxChecks: 30 });

    expect(result?.checksPerformed).toBe(3);
    expect(result?.exhausted).toBe(true);
    expect(result?.winner.item.contentid).toBe("1");
  });

  it("빈 배열을 넣으면 null을 반환하고 검사하지 않는다", async () => {
    const result = await selectAvailableCandidate([]);
    expect(result).toBeNull();
    expect(mockedCheck).not.toHaveBeenCalled();
  });

  it("API 오류로 인한 관대 통과(uncertain=true)도 정상 채택이지 폴백이 아니다", async () => {
    const c1 = makeCandidate("1", 0.9);
    const c2 = makeCandidate("2", 0.8);
    mockedCheck.mockResolvedValueOnce(uncertainOpenResult());

    const result = await selectAvailableCandidate([c1, c2]);

    expect(result?.winner.item.contentid).toBe("1");
    expect(result?.winner.availabilityUncertain).toBe(true);
    expect(result?.exhausted).toBe(false);
    expect(mockedCheck).toHaveBeenCalledTimes(1);
  });
});
