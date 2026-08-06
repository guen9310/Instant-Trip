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
  /** 실제 출발("여기로 갈게요")·장소 직접 선택처럼 탐색이 끝나는 지점에서 호출 —
   *  거절 이력(rejectedPlaceIds)까지 전부 초기화한다. */
  resetRerolls: () => void;
  /** /start를 거쳐 새로 추천을 받을 때 호출 — 리롤 소진 카운트만 새로 채워준다.
   *  거절 이력은 그대로 둬서, 방금 거절한 장소가 재생성 결과에 다시 나오지 않게 한다. */
  resetRerollCount: () => void;
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
  resetRerollCount: () => set({ rerollCount: 0 }),
  addRejection: (placeId) =>
    set((s) => ({
      rejectedPlaceIds: [...s.rejectedPlaceIds, placeId],
      rerollCount: s.rerollCount + 1,
    })),
}));
