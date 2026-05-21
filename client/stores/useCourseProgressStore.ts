import { create } from "zustand";

type CourseProgressStore = {
  courseId: string | null;
  currentIdx: number;
  totalPlaces: number;
  start: (courseId: string, totalPlaces: number) => void;
  advance: () => void;
  reset: () => void;
};

export const useCourseProgressStore = create<CourseProgressStore>((set) => ({
  courseId: null,
  currentIdx: 0,
  totalPlaces: 0,
  start: (courseId, totalPlaces) =>
    set({ courseId, currentIdx: 0, totalPlaces }),
  advance: () =>
    set((s) => ({ currentIdx: Math.min(s.currentIdx + 1, s.totalPlaces - 1) })),
  reset: () => set({ courseId: null, currentIdx: 0, totalPlaces: 0 }),
}));
