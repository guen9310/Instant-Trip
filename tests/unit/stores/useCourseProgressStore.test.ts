import { describe, it, expect, beforeEach } from "vitest";
import { useCourseProgressStore } from "@/client/stores/useCourseProgressStore";

const INITIAL_STATE = {
  courseId: null,
  rejectedPlaceIds: [],
  rerollCount: 0,
  startedAt: null,
  completedAt: null,
};

describe("useCourseProgressStore", () => {
  beforeEach(() => {
    useCourseProgressStore.setState(INITIAL_STATE);
  });

  it("addRejection은 placeId를 누적하고 rerollCount를 1 올린다", () => {
    useCourseProgressStore.getState().addRejection("p1");
    useCourseProgressStore.getState().addRejection("p2");
    const state = useCourseProgressStore.getState();
    expect(state.rejectedPlaceIds).toEqual(["p1", "p2"]);
    expect(state.rerollCount).toBe(2);
  });

  it("resetRerolls는 rejectedPlaceIds와 rerollCount를 전부 초기화한다", () => {
    useCourseProgressStore.getState().addRejection("p1");
    useCourseProgressStore.getState().resetRerolls();
    const state = useCourseProgressStore.getState();
    expect(state.rerollCount).toBe(0);
    expect(state.rejectedPlaceIds).toEqual([]);
  });

  it("start는 courseId·startedAt을 채우고 completedAt을 지운다", () => {
    useCourseProgressStore.setState({ completedAt: 123 });
    useCourseProgressStore.getState().start("course-1");
    const state = useCourseProgressStore.getState();
    expect(state.courseId).toBe("course-1");
    expect(state.startedAt).not.toBeNull();
    expect(state.completedAt).toBeNull();
  });
});
