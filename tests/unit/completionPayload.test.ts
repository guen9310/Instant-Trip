import { describe, it, expect } from "vitest";
import { buildCompletionPayload } from "@/shared/utils/completionPayload";
import { courseCompletionSchema } from "@/shared/schemas/courseCompletion";
import type { PendingCourse } from "@/shared/types/course.types";

const pending: Partial<PendingCourse> = {
  courseId: "abc123",
  courseName: "한적한 오후 산책",
  region: "울산 남구",
  scale: "light",
  mapX: 129.3114, // 출발지 경도
  mapY: 35.5384, // 출발지 위도
  place: {
    id: "p1",
    cat: "도시공원",
    name: "울산대공원",
    addr: "울산 남구 대공원로 94",
    hours: "",
    time: "",
    dur: "30분~1시간 정도",
    badge: { text: "공원", variant: "secondary" },
    desc: "도심 속 대형 공원",
    coord: { lat: 35.552, lng: 129.32 }, // 출발지에서 약 1.7km
    imageUrl: null,
    availabilityUncertain: false,
    estimatedDuration: { min: 30, max: 60 },
    tags: [],
  },
};

describe("buildCompletionPayload", () => {
  it("완전한 pendingCourse로 zod를 통과하는 페이로드를 만든다", () => {
    const payload = buildCompletionPayload({
      pending,
      status: "completed",
      startedAt: 1750000000000,
      completedAt: 1750003600000,
      rating: 4,
      reactions: ["조용해요"],
      stamps: [{ t: 1750001000000, distM: 45 }],
    });
    expect(payload).not.toBeNull();
    const parsed = courseCompletionSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.stamps).toHaveLength(1);
    }
  });

  it("출발 좌표와 장소 좌표로 이동 거리(m)를 계산한다", () => {
    const payload = buildCompletionPayload({
      pending,
      status: "completed",
      startedAt: null,
      completedAt: null,
    });
    // (35.5384,129.3114) → (35.552,129.32): 약 1.7km
    expect(payload?.travelDistM).toBeGreaterThan(1500);
    expect(payload?.travelDistM).toBeLessThan(2000);
  });

  it("좌표가 없으면 travelDistM은 null", () => {
    const payload = buildCompletionPayload({
      pending: { ...pending, mapX: undefined, mapY: undefined },
      status: "completed",
      startedAt: null,
      completedAt: null,
    });
    expect(payload?.travelDistM).toBeNull();
  });

  it("estimatedDuration 없는 장소(구버전/mock)는 null — 기록하지 않는다", () => {
    const legacyPlace = { ...pending.place! };
    // @ts-expect-error 구버전 localStorage 데이터 시뮬레이션
    delete legacyPlace.estimatedDuration;
    const payload = buildCompletionPayload({
      pending: { ...pending, place: legacyPlace },
      status: "completed",
      startedAt: null,
      completedAt: null,
    });
    expect(payload).toBeNull();
  });

  it("courseName 없으면 null", () => {
    const payload = buildCompletionPayload({
      pending: { ...pending, courseName: undefined },
      status: "abandoned",
      startedAt: 1750000000000,
      completedAt: null,
    });
    expect(payload).toBeNull();
  });

  it("알 수 없는 scale은 moderate로 폴백한다", () => {
    const payload = buildCompletionPayload({
      pending: { ...pending, scale: "이상한값" },
      status: "completed",
      startedAt: null,
      completedAt: null,
    });
    const parsed = courseCompletionSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });
});
