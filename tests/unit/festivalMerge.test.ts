import { describe, it, expect } from "vitest";
import {
  normalizeFestivalName,
  mergeFestivals,
  MATCH_DISTANCE_KM,
} from "@/lib/pipeline/festivalMerge";
import type { CulturalFestival } from "@/lib/clients/cultural-festival";
import type { TourFestivalItem } from "@/lib/tour/searchFestival";

// ─── normalizeFestivalName ────────────────────────────────────────────────────

describe("normalizeFestivalName", () => {
  it("연도 접두사를 제거한다", () => {
    expect(normalizeFestivalName("2026 태화강마두희축제")).toBe("태화강마두희축제");
  });

  it("제N회 접두사를 제거한다", () => {
    expect(normalizeFestivalName("제6회 송도해변축제")).toBe("송도해변축제");
  });

  it("제 없는 N회 접두사를 제거한다", () => {
    expect(normalizeFestivalName("6회 광주비엔날레")).toBe("광주비엔날레");
  });

  it("공백 없는 제N회 접두사를 제거한다", () => {
    expect(normalizeFestivalName("제10회강릉단오제")).toBe("강릉단오제");
  });

  it("연도 + 제N회 순서대로 두 번 제거한다", () => {
    // "2026 제3회 울산조선해양축제"
    // → replace year → "제3회 울산조선해양축제"
    // → replace 회차  → "울산조선해양축제"
    // → replace space → "울산조선해양축제"
    expect(normalizeFestivalName("2026 제3회 울산조선해양축제")).toBe("울산조선해양축제");
  });

  it("이름 중간 공백을 모두 제거한다", () => {
    expect(normalizeFestivalName("부산 국제 영화제")).toBe("부산국제영화제");
  });

  it("접두사 없는 이름은 그대로 반환한다", () => {
    expect(normalizeFestivalName("부산불꽃축제")).toBe("부산불꽃축제");
  });

  it("실데이터: 2025 서울빛초롱축제", () => {
    expect(normalizeFestivalName("2025 서울빛초롱축제")).toBe("서울빛초롱축제");
  });
});

// ─── 테스트 픽스처 ────────────────────────────────────────────────────────────

const basePublic: CulturalFestival = {
  fstvlNm: "울산조선해양축제",
  opar: "울산광역시",
  fstvlStartDate: "2025-07-24",
  fstvlEndDate: "2025-07-26",
  fstvlCo: "조선해양 관련 축제입니다",
  mnnstNm: "울산광역시",
  auspcInsttNm: "",
  suprtInsttNm: "",
  phoneNumber: "052-000-0000",
  homepageUrl: "https://example.com",
  relateInfo: "",
  rdnmadr: "울산광역시 중구 학성동",
  lnmadr: "울산광역시 중구 학성동",
  latitude: 35.5384,
  longitude: 129.3114,
  referenceDate: "2026-01-01",
  insttCode: "7000000",
  insttNm: "울산광역시",
};

const baseTour: TourFestivalItem = {
  contentid: "3000001",
  contenttypeid: "15",
  title: "2026 울산조선해양축제",  // 연도 접두사 있어도 정규화 후 매칭
  addr1: "울산광역시 중구",
  addr2: "",
  mapx: "129.3114",
  mapy: "35.5384",
  firstimage: "https://cdn.tour.go.kr/festival.jpg",
  firstimage2: "https://cdn.tour.go.kr/festival_thumb.jpg",
  areacode: "7",
  sigungucode: "1",
  eventstartdate: "20260724",
  eventenddate: "20260726",
  cat1: "A",
  cat2: "A02",
  cat3: "A0207",
  tel: "052-000-9999",
};

// ─── mergeFestivals ───────────────────────────────────────────────────────────

describe("mergeFestivals", () => {
  it("매칭 쌍: 날짜·이미지는 Tour 우선, 설명은 공공 유지, sources = [public,tour]", () => {
    const { festivals, stats } = mergeFestivals([basePublic], [baseTour]);
    expect(festivals).toHaveLength(1);
    expect(festivals[0].fstvlStartDate).toBe("2026-07-24");
    expect(festivals[0].fstvlEndDate).toBe("2026-07-26");
    expect(festivals[0].imageUrl).toBe("https://cdn.tour.go.kr/festival.jpg");
    expect(festivals[0].fstvlCo).toBe("조선해양 관련 축제입니다");
    expect(festivals[0].sources).toEqual(["public", "tour"]);
    expect(stats.matchedCount).toBe(1);
    expect(stats.publicOnlyCount).toBe(0);
    expect(stats.tourOnlyCount).toBe(0);
  });

  it("공공 단독 축제: imageUrl 없이 sources = [public]", () => {
    const { festivals, stats } = mergeFestivals([basePublic], []);
    expect(festivals).toHaveLength(1);
    expect(festivals[0].imageUrl).toBeUndefined();
    expect(festivals[0].sources).toEqual(["public"]);
    expect(stats.publicOnlyCount).toBe(1);
    expect(stats.imageCount).toBe(0);
  });

  it("Tour 단독 축제: imageUrl 있고 sources = [tour]", () => {
    const { festivals, stats } = mergeFestivals([], [baseTour]);
    expect(festivals).toHaveLength(1);
    expect(festivals[0].fstvlNm).toBe("2026 울산조선해양축제");
    expect(festivals[0].imageUrl).toBe("https://cdn.tour.go.kr/festival.jpg");
    expect(festivals[0].sources).toEqual(["tour"]);
    expect(stats.tourOnlyCount).toBe(1);
  });

  it(`거리 ${MATCH_DISTANCE_KM}km 초과 시 매칭 거부, distMismatchPairs에 기록`, () => {
    const farTour: TourFestivalItem = {
      ...baseTour,
      title: "울산조선해양축제",
      mapx: "127.0",  // 서울 부근
      mapy: "37.5",
    };
    const { festivals, stats } = mergeFestivals([basePublic], [farTour]);
    // 두 소스 모두 남아 결합 실패 → 2건
    expect(festivals).toHaveLength(2);
    expect(stats.matchedCount).toBe(0);
    expect(stats.distMismatchPairs).toHaveLength(1);
    expect(stats.distMismatchPairs[0].name).toBe("울산조선해양축제");
  });

  it("공공 좌표 없을 때 이름만으로 매칭하고 coordMissMatch 플래그 설정", () => {
    const pubNoCoord: CulturalFestival = {
      ...basePublic,
      latitude: NaN,
      longitude: NaN,
    };
    const { festivals, stats } = mergeFestivals([pubNoCoord], [baseTour]);
    expect(stats.matchedCount).toBe(1);
    expect(stats.coordMissMatchCount).toBe(1);
    expect(festivals[0].coordMissMatch).toBe(true);
  });

  it("Tour 좌표 없을 때 이름만으로 매칭하고 coordMissMatch 플래그 설정", () => {
    const tourNoCoord: TourFestivalItem = {
      ...baseTour,
      title: "울산조선해양축제",
      mapx: "",
      mapy: "",
    };
    const { festivals, stats } = mergeFestivals([basePublic], [tourNoCoord]);
    expect(stats.matchedCount).toBe(1);
    expect(stats.coordMissMatchCount).toBe(1);
  });

  it("시작일 불일치 시 dateMismatchPairs에 기록", () => {
    // basePublic.fstvlStartDate = 2025-07-24, baseTour.eventstartdate → 2026-07-24
    const { stats } = mergeFestivals([basePublic], [baseTour]);
    expect(stats.dateMismatchPairs).toHaveLength(1);
    expect(stats.dateMismatchPairs[0].publicStart).toBe("2025-07-24");
    expect(stats.dateMismatchPairs[0].tourStart).toBe("2026-07-24");
  });

  it("병합 후 이미지 보유 건수를 stats.imageCount에 반영한다", () => {
    const { stats } = mergeFestivals([basePublic], [baseTour]);
    expect(stats.imageCount).toBe(1);
  });

  it("firstimage 비어있으면 firstimage2를 imageUrl로 사용한다", () => {
    const tourNoFirst: TourFestivalItem = {
      ...baseTour,
      firstimage: "",
    };
    const { festivals } = mergeFestivals([basePublic], [tourNoFirst]);
    expect(festivals[0].imageUrl).toBe("https://cdn.tour.go.kr/festival_thumb.jpg");
  });

  it("좌표: 공공 우선, 공공 없으면 Tour 좌표 사용", () => {
    const pubNoCoord: CulturalFestival = {
      ...basePublic,
      fstvlNm: "울산조선해양축제",
      latitude: NaN,
      longitude: NaN,
    };
    const { festivals } = mergeFestivals([pubNoCoord], [baseTour]);
    expect(festivals[0].latitude).toBeCloseTo(35.5384, 3);
    expect(festivals[0].longitude).toBeCloseTo(129.3114, 3);
  });
});
