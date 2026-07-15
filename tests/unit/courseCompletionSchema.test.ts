import { describe, it, expect } from "vitest";
import {
  courseCompletionSchema,
  type CourseCompletionPayload,
} from "@/shared/schemas/courseCompletion";

const validPayload: CourseCompletionPayload = {
  courseName: "한적한 오후 산책",
  region: "울산 남구",
  scale: "light",
  place: {
    name: "울산대공원",
    category: "도시공원",
    address: "울산 남구 대공원로 94",
    coord: { lat: 35.5384, lng: 129.3114 },
    stayMin: 30,
    stayMax: 60,
    availabilityUncertain: false,
    description: "도심 속 대형 공원",
    badgeText: "공원",
    badgeVariant: "secondary",
  },
  startedAt: 1750000000000,
  completedAt: 1750003600000,
  rating: 4,
  reactions: ["조용해요", "또 올래요"],
};

describe("courseCompletionSchema", () => {
  it("유효한 페이로드를 통과시킨다", () => {
    const result = courseCompletionSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("stayMin > stayMax는 거부한다", () => {
    const result = courseCompletionSchema.safeParse({
      ...validPayload,
      place: { ...validPayload.place, stayMin: 90, stayMax: 60 },
    });
    expect(result.success).toBe(false);
  });

  it("rating 범위(1~5) 밖은 거부한다", () => {
    for (const rating of [0, 6]) {
      const result = courseCompletionSchema.safeParse({
        ...validPayload,
        rating,
      });
      expect(result.success).toBe(false);
    }
  });

  it("rating/startedAt/completedAt은 null을 허용한다 (그냥 넘기기 · 새로고침 유실)", () => {
    const result = courseCompletionSchema.safeParse({
      ...validPayload,
      rating: null,
      startedAt: null,
      completedAt: null,
    });
    expect(result.success).toBe(true);
  });

  it("scale 누락 시 moderate로 기본값 처리한다", () => {
    const rest: Record<string, unknown> = { ...validPayload };
    delete rest.scale;
    const result = courseCompletionSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.scale).toBe("moderate");
  });

  it("coord null(좌표 없는 장소)을 허용한다", () => {
    const result = courseCompletionSchema.safeParse({
      ...validPayload,
      place: { ...validPayload.place, coord: null },
    });
    expect(result.success).toBe(true);
  });

  it("status 누락 시 completed로 기본값 처리한다", () => {
    const result = courseCompletionSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("completed");
  });

  it("abandoned 상태 + completedAt null 조합을 허용한다", () => {
    const result = courseCompletionSchema.safeParse({
      ...validPayload,
      status: "abandoned",
      completedAt: null,
      rating: null,
    });
    expect(result.success).toBe(true);
  });

  it("위치 도장 배열을 검증한다 — 음수 거리는 거부", () => {
    const ok = courseCompletionSchema.safeParse({
      ...validPayload,
      stamps: [{ t: 1750001000000, distM: 45 }],
    });
    expect(ok.success).toBe(true);

    const bad = courseCompletionSchema.safeParse({
      ...validPayload,
      stamps: [{ t: 1750001000000, distM: -5 }],
    });
    expect(bad.success).toBe(false);
  });

  it("travelDistM/stamps 누락 시 null/[]로 기본값 처리한다", () => {
    const result = courseCompletionSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.travelDistM).toBeNull();
      expect(result.data.stamps).toEqual([]);
    }
  });
});
