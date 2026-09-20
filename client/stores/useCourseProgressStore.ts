"use client";

import { create } from "zustand";

export const MAX_REROLLS = 3;

// 추천 탐색 중의 거절·재추천 상태만 담는다. 진행 중 코스의 시작·완료 시각은 새로고침에도
// 남아야 해서 메모리가 아닌 startedCourse 저장소(client/startedCourseStorage.ts)가 소유한다.
type CourseProgressStore = {
  rejectedPlaceIds: string[];
  rerollCount: number;
  /** 실제 출발("여기로 갈게요")·장소 직접 선택·/start를 거친 재추천처럼 새 탐색이
   *  시작되는 지점에서 호출 — 거절 이력(rejectedPlaceIds)까지 전부 초기화한다. */
  resetRerolls: () => void;
  /** 거절 시 호출 — placeId를 누적하고 rerollCount를 1 올린다 */
  addRejection: (placeId: string) => void;
};

export const useCourseProgressStore = create<CourseProgressStore>((set) => ({
  rejectedPlaceIds: [],
  rerollCount: 0,
  resetRerolls: () => set({ rejectedPlaceIds: [], rerollCount: 0 }),
  addRejection: (placeId) =>
    set((s) => ({
      rejectedPlaceIds: [...s.rejectedPlaceIds, placeId],
      rerollCount: s.rerollCount + 1,
    })),
}));
