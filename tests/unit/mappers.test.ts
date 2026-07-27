import { describe, it, expect } from "vitest";
import { toJourneyPlace, toCompletedCourse, toCourseProgress } from "@/server/mappers";
import type { courses, coursePlaces, courseCompletions } from "@/server/schema";

type CourseRow = typeof courses.$inferSelect;
type PlaceRow = typeof coursePlaces.$inferSelect;
type CompletionRow = typeof courseCompletions.$inferSelect;

function makePlaceRow(overrides: Partial<PlaceRow> = {}): PlaceRow {
  return {
    id: "place-1",
    courseId: "course-1",
    orderIndex: 0,
    name: "가든 나이트 마켓",
    category: "축제",
    address: "울산광역시 남구 대공원로 94 (옥동)",
    lat: "35.5310582726",
    lng: "129.2938457635",
    stayMin: 60,
    stayMax: 120,
    availabilityUncertain: false,
    description: "여름밤 공원에서 열리는 야시장",
    badgeText: "축제",
    badgeVariant: "secondary",
    placeUrl: null,
    programInfo: null,
    organizerUrl: null,
    createdAt: new Date("2026-07-27T00:00:00Z"),
    ...overrides,
  };
}

function makeCourseRow(overrides: Partial<CourseRow> = {}): CourseRow {
  return {
    id: "course-1",
    name: "가든 나이트 마켓",
    scale: "light",
    createdAt: new Date("2026-07-27T00:00:00Z"),
    ...overrides,
  };
}

function makeCompletionRow(overrides: Partial<CompletionRow> = {}): CompletionRow {
  return {
    id: "completion-1",
    userId: "user-1",
    courseId: "course-1",
    status: "completed",
    rating: 4,
    review: "좋았어요",
    startedAt: new Date("2026-07-27T10:00:00Z"),
    completedAt: new Date("2026-07-27T11:30:00Z"),
    createdAt: new Date("2026-07-27T10:00:00Z"),
    ...overrides,
  };
}

describe("toJourneyPlace", () => {
  it("일반 장소(programInfo/organizerUrl 없음) — null 그대로 전달된다", () => {
    const result = toJourneyPlace(makePlaceRow());
    expect(result.programInfo).toBeNull();
    expect(result.organizerUrl).toBeNull();
  });

  it("축제 장소 — programInfo/organizerUrl을 그대로 전달한다", () => {
    const row = makePlaceRow({
      programInfo: { main: "야시장", extra: ["회전목마", "버스킹 공연"] },
      organizerUrl: "http://ulsanstorynightmarket.com/",
    });
    const result = toJourneyPlace(row);
    expect(result.programInfo).toEqual({ main: "야시장", extra: ["회전목마", "버스킹 공연"] });
    expect(result.organizerUrl).toBe("http://ulsanstorynightmarket.com/");
  });

  it("좌표가 있으면 숫자로 변환하고, 없으면 null", () => {
    expect(toJourneyPlace(makePlaceRow()).coord).toEqual({
      lat: 35.5310582726,
      lng: 129.2938457635,
    });
    expect(toJourneyPlace(makePlaceRow({ lat: null, lng: null })).coord).toBeNull();
  });

  it("DB에 없는 필드(hours/time/tags/imageUrl)는 빈 값으로 채운다", () => {
    const result = toJourneyPlace(makePlaceRow());
    expect(result.hours).toBe("");
    expect(result.time).toBe("");
    expect(result.tags).toEqual([]);
    expect(result.imageUrl).toBeNull();
  });

  it("estimatedDuration/dur을 stayMin·stayMax로부터 계산한다", () => {
    const result = toJourneyPlace(makePlaceRow({ stayMin: 90, stayMax: 150 }));
    expect(result.estimatedDuration).toEqual({ min: 90, max: 150 });
  });
});

describe("toCompletedCourse", () => {
  it("축제 장소를 포함한 여러 장소를 매핑하고, programInfo/organizerUrl을 보존한다", () => {
    const places = [
      makePlaceRow({
        id: "p1",
        name: "가든 나이트 마켓",
        programInfo: { main: "야시장", extra: ["버스킹 공연"] },
        organizerUrl: "http://ulsanstorynightmarket.com/",
      }),
      makePlaceRow({ id: "p2", name: "일반 장소", category: "관광지" }),
    ];

    const result = toCompletedCourse(makeCompletionRow(), makeCourseRow(), places);

    expect(result.places).toHaveLength(2);
    expect(result.places[0].programInfo).toEqual({ main: "야시장", extra: ["버스킹 공연"] });
    expect(result.places[0].organizerUrl).toBe("http://ulsanstorynightmarket.com/");
    expect(result.places[1].programInfo).toBeNull();
    expect(result.places[1].organizerUrl).toBeNull();
  });

  it("rating/review가 null이면 0과 빈 문자열로 기본값 처리한다", () => {
    const result = toCompletedCourse(
      makeCompletionRow({ rating: null, review: null }),
      makeCourseRow(),
      [],
    );
    expect(result.rating).toBe(0);
    expect(result.review).toBe("");
  });

  it("completedAt을 YYYY.MM.DD 형식으로 포맷한다", () => {
    const result = toCompletedCourse(
      makeCompletionRow({ completedAt: new Date("2026-07-27T11:30:00Z") }),
      makeCourseRow(),
      [],
    );
    expect(result.date).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
  });

  it("completedAt이 null이면 빈 문자열", () => {
    const result = toCompletedCourse(
      makeCompletionRow({ completedAt: null }),
      makeCourseRow(),
      [],
    );
    expect(result.date).toBe("");
  });

  it("badge/description 기본값 — badgeText 없으면 category, description 없으면 빈 문자열", () => {
    const places = [
      makePlaceRow({ badgeText: null, description: null, category: "레포츠" }),
    ];
    const result = toCompletedCourse(makeCompletionRow(), makeCourseRow(), places);
    expect(result.places[0].badge.text).toBe("레포츠");
    expect(result.places[0].description).toBe("");
  });
});

describe("toCourseProgress", () => {
  it("course의 name/id만 그대로 옮긴다", () => {
    const result = toCourseProgress(makeCompletionRow(), makeCourseRow({ id: "c1", name: "테스트 코스" }));
    expect(result).toEqual({ name: "테스트 코스", courseId: "c1" });
  });
});
