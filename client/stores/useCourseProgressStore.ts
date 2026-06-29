import { create } from "zustand";

export const MAX_REROLLS = 3;

type CourseProgressStore = {
  courseId: string | null;
  currentIdx: number;
  totalPlaces: number;
  rejectedPlaceIds: string[];
  rerollCount: number;
  start: (courseId: string, totalPlaces: number) => void;
  advance: () => void;
  reset: () => void;
  /** 거절 시 호출 — placeId를 누적하고 rerollCount를 1 올린다 */
  addRejection: (placeId: string) => void;
  /** 장소 거절 없이 단순 다시 뽑기 시 호출 */
  incrementReroll: () => void;
};

export const useCourseProgressStore = create<CourseProgressStore>((set) => ({
  courseId: null,
  currentIdx: 0,
  totalPlaces: 0,
  rejectedPlaceIds: [],
  rerollCount: 0,
  start: (courseId, totalPlaces) =>
    set({ courseId, currentIdx: 0, totalPlaces }),
  advance: () =>
    set((s) => ({ currentIdx: Math.min(s.currentIdx + 1, s.totalPlaces - 1) })),
  reset: () =>
    set({ courseId: null, currentIdx: 0, totalPlaces: 0, rejectedPlaceIds: [], rerollCount: 0 }),
  addRejection: (placeId) =>
    set((s) => ({
      rejectedPlaceIds: [...s.rejectedPlaceIds, placeId],
      rerollCount: s.rerollCount + 1,
    })),
  incrementReroll: () =>
    set((s) => ({ rerollCount: s.rerollCount + 1 })),
}));
