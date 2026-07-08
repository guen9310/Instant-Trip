import { create } from "zustand";

export const MAX_REROLLS = 3;

// 위치 도장 — 진행 화면 재개/완료 등 기존 이벤트 순간의 장소와의 거리(m) 기록
export type LocationStamp = { t: number; distM: number };

const MAX_STAMPS = 100;

type CourseProgressStore = {
  courseId: string | null;
  rejectedPlaceIds: string[];
  rerollCount: number;
  startedAt: number | null;
  completedAt: number | null;
  stamps: LocationStamp[];
  start: (courseId: string) => void;
  complete: () => void;
  reset: () => void;
  /** 거절 시 호출 — placeId를 누적하고 rerollCount를 1 올린다 */
  addRejection: (placeId: string) => void;
  addStamp: (stamp: LocationStamp) => void;
};

export const useCourseProgressStore = create<CourseProgressStore>((set) => ({
  courseId: null,
  rejectedPlaceIds: [],
  rerollCount: 0,
  startedAt: null,
  completedAt: null,
  stamps: [],
  start: (courseId) =>
    set({ courseId, startedAt: Date.now(), completedAt: null, stamps: [] }),
  complete: () => set({ completedAt: Date.now() }),
  reset: () =>
    set({
      courseId: null,
      rejectedPlaceIds: [],
      rerollCount: 0,
      startedAt: null,
      completedAt: null,
      stamps: [],
    }),
  addRejection: (placeId) =>
    set((s) => ({
      rejectedPlaceIds: [...s.rejectedPlaceIds, placeId],
      rerollCount: s.rerollCount + 1,
    })),
  addStamp: (stamp) =>
    set((s) =>
      s.stamps.length >= MAX_STAMPS ? s : { stamps: [...s.stamps, stamp] },
    ),
}));
