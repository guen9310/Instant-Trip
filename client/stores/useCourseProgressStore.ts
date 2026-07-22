import { create } from "zustand";

export const MAX_REROLLS = 3;

type CourseProgressStore = {
  courseId: string | null;
  rejectedPlaceIds: string[];
  rerollCount: number;
  startedAt: number | null;
  completedAt: number | null;
  start: (courseId: string) => void;
  complete: () => void;
  reset: () => void;
  /** 새 코스 생성 시 호출 — 리롤로 쌓인 거절 이력만 초기화한다 */
  resetRerolls: () => void;
  /** 거절 시 호출 — placeId를 누적하고 rerollCount를 1 올린다 */
  addRejection: (placeId: string) => void;
};

export const useCourseProgressStore = create<CourseProgressStore>((set) => ({
  courseId: null,
  rejectedPlaceIds: [],
  rerollCount: 0,
  startedAt: null,
  completedAt: null,
  start: (courseId) =>
    set({ courseId, startedAt: Date.now(), completedAt: null }),
  complete: () => set({ completedAt: Date.now() }),
  reset: () =>
    set({
      courseId: null,
      rejectedPlaceIds: [],
      rerollCount: 0,
      startedAt: null,
      completedAt: null,
    }),
  resetRerolls: () => set({ rejectedPlaceIds: [], rerollCount: 0 }),
  addRejection: (placeId) =>
    set((s) => ({
      rejectedPlaceIds: [...s.rejectedPlaceIds, placeId],
      rerollCount: s.rerollCount + 1,
    })),
}));
