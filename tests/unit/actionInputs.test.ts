import { describe, expect, it } from "vitest";
import {
  generateCourseFromFestivalInputSchema,
  generateCourseInputSchema,
  homeLocationInputSchema,
  nearbyPoisInputSchema,
} from "@/shared/schemas/actionInputs";

const validCourseInput = {
  mapX: 129.3114,
  mapY: 35.5384,
  scale: "light",
  prefs: {
    travel: "walk",
    party: "solo",
    vibe: "quiet",
    food: "matjip",
    indoor: "indoor",
  },
};

describe("Server Action 입력 스키마", () => {
  it("유효한 홈 좌표와 코스 생성 요청을 통과시킨다", () => {
    expect(
      homeLocationInputSchema.safeParse({
        lat: 35.5384,
        lng: 129.3114,
        city: "울산광역시",
      }).success,
    ).toBe(true);
    expect(generateCourseInputSchema.safeParse(validCourseInput).success).toBe(true);
  });

  it("범위를 벗어난 좌표와 허용되지 않은 취향 값은 거부한다", () => {
    expect(nearbyPoisInputSchema.safeParse({ lat: 91, lng: 129.3114 }).success).toBe(false);
    expect(
      generateCourseInputSchema.safeParse({
        ...validCourseInput,
        prefs: { ...validCourseInput.prefs, travel: "car" },
      }).success,
    ).toBe(false);
  });

  it("재추천 제한을 넘어선 제외 목록과 최대 반경 초과 요청을 거부한다", () => {
    expect(
      generateCourseInputSchema.safeParse({
        ...validCourseInput,
        excludeIds: ["a", "b", "c", "d"],
      }).success,
    ).toBe(false);
    expect(
      generateCourseInputSchema.safeParse({ ...validCourseInput, radiusM: 20_001 }).success,
    ).toBe(false);
  });

  it("종료일보다 늦은 시작일의 축제 요청을 거부한다", () => {
    expect(
      generateCourseFromFestivalInputSchema.safeParse({
        id: "festival-1",
        name: "축제",
        status: "upcoming",
        period: "08.10 ~ 08.09",
        address: "울산광역시",
        imageUrl: null,
        description: null,
        contentId: null,
        lat: 35.5384,
        lng: 129.3114,
        startDate: "2026-08-10",
        endDate: "2026-08-09",
      }).success,
    ).toBe(false);
  });
});
