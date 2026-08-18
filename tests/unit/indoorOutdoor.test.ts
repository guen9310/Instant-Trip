import { describe, it, expect } from "vitest";
import { classifyIndoorOutdoor } from "@/lib/pipeline/indoorOutdoor";
import type { TourItem } from "@/lib/tour/types";

function makeItem(overrides: Partial<TourItem> = {}): TourItem {
  return {
    contentid: "1",
    contenttypeid: "12",
    title: "테스트 장소",
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

describe("classifyIndoorOutdoor", () => {
  it("contenttypeid=14(문화시설) → indoor", () => {
    expect(classifyIndoorOutdoor(makeItem({ contenttypeid: "14" }))).toBe("indoor");
  });

  it("lclsSystm2=VE07(전시시설) → indoor", () => {
    expect(
      classifyIndoorOutdoor(makeItem({ contenttypeid: "12", lclsSystm2: "VE07" })),
    ).toBe("indoor");
  });

  it("kakaoCategory=CT1 → indoor", () => {
    expect(
      classifyIndoorOutdoor(makeItem({ source: "kakao", kakaoCategory: "CT1" })),
    ).toBe("indoor");
  });

  it("contenttypeid=12(관광지) → outdoor", () => {
    expect(classifyIndoorOutdoor(makeItem({ contenttypeid: "12" }))).toBe("outdoor");
  });

  it("kakaoCategory=AT4 → outdoor", () => {
    expect(
      classifyIndoorOutdoor(makeItem({ source: "kakao", kakaoCategory: "AT4" })),
    ).toBe("outdoor");
  });

  it("레포츠(28) + 제목에 실내 키워드 포함 → indoor", () => {
    expect(
      classifyIndoorOutdoor(makeItem({ contenttypeid: "28", title: "OO 실내클라이밍장" })),
    ).toBe("indoor");
  });

  it("레포츠(28) + 키워드 없으면 → outdoor(기본값)", () => {
    expect(
      classifyIndoorOutdoor(makeItem({ contenttypeid: "28", title: "OO 등산로" })),
    ).toBe("outdoor");
  });

  it("그 외 contenttypeid(예: 15 행사) → unknown", () => {
    expect(classifyIndoorOutdoor(makeItem({ contenttypeid: "15" }))).toBe("unknown");
  });

  it("source=kakao인데 contenttypeid=14만 있고 kakaoCategory가 없으면 → unknown (contenttypeid로 오판 금지)", () => {
    expect(
      classifyIndoorOutdoor(makeItem({ source: "kakao", contenttypeid: "14" })),
    ).toBe("unknown");
  });

  it("source=kakao인데 contenttypeid=12만 있고 kakaoCategory가 없으면 → unknown", () => {
    expect(
      classifyIndoorOutdoor(makeItem({ source: "kakao", contenttypeid: "12" })),
    ).toBe("unknown");
  });
});
