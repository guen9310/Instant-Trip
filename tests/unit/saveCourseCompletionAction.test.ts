import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveCourseCompletionAction } from "@/app/actions/completion";
import type { CourseCompletionPayload } from "@/shared/schemas/courseCompletion";

const { mockSet, mockWhere, mockReturning } = vi.hoisted(() => ({
  mockSet: vi.fn(),
  mockWhere: vi.fn(),
  mockReturning: vi.fn(),
}));
vi.mock("@/server/db", () => ({
  db: {
    update: () => ({
      set: (value: unknown) => {
        mockSet(value);
        return {
          where: (cond: unknown) => {
            mockWhere(cond);
            return { returning: mockReturning };
          },
        };
      },
    }),
  },
}));
vi.mock("@/server/session", () => ({
  getFreshAuthState: vi.fn().mockResolvedValue({
    status: "authenticated",
    session: { user: { id: "owner" } },
  }),
}));

const COMPLETION_ID = "11111111-1111-4111-8111-111111111111";
const DB_COURSE_ID = "22222222-2222-4222-8222-222222222222";

function payload(overrides: Partial<CourseCompletionPayload> = {}): CourseCompletionPayload {
  return {
    courseName: "코스 A",
    scale: "light",
    status: "completed",
    completionId: COMPLETION_ID,
    dbCourseId: DB_COURSE_ID,
    place: {
      name: "장소 A",
      category: "공원",
      address: "",
      coord: null,
      stayMin: 30,
      stayMax: 60,
      availabilityUncertain: false,
      description: "",
      badgeText: "",
      badgeVariant: "accent",
      placeUrl: null,
      programInfo: null,
      organizerUrl: null,
    },
    startedAt: 1_000,
    completedAt: 2_000,
    rating: null,
    reactions: [],
    ...overrides,
  };
}

describe("saveCourseCompletionAction — UPDATE 경로", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("갱신된 행이 없으면 저장 성공으로 오인하지 않는다", async () => {
    mockReturning.mockResolvedValue([]);
    const result = await saveCourseCompletionAction(payload());
    expect(result).toEqual({ ok: false });
  });

  it("갱신되면 같은 기록 ID를 돌려준다", async () => {
    mockReturning.mockResolvedValue([{ id: COMPLETION_ID }]);
    const result = await saveCourseCompletionAction(payload());
    expect(result).toEqual({ ok: true, completionId: COMPLETION_ID, dbCourseId: DB_COURSE_ID });
  });

  it("시작 시각을 모르면 DB의 기존 시작 시각을 덮어쓰지 않는다", async () => {
    mockReturning.mockResolvedValue([{ id: COMPLETION_ID }]);
    await saveCourseCompletionAction(payload({ startedAt: null }));
    expect(mockSet.mock.calls[0][0]).not.toHaveProperty("startedAt");
    expect(mockSet.mock.calls[0][0].completedAt).toEqual(new Date(2_000));
  });

  it("시작 시각을 알면 그대로 기록한다", async () => {
    mockReturning.mockResolvedValue([{ id: COMPLETION_ID }]);
    await saveCourseCompletionAction(payload());
    expect(mockSet.mock.calls[0][0].startedAt).toEqual(new Date(1_000));
  });
});
