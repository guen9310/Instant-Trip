import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCourseActive } from "@/client/hooks/useCourseActive";
import { useCourseDone } from "@/client/hooks/useCourseDone";
import type { JourneyPlace, ResumableCourse, StartedCourse } from "@/shared/types/course.types";

const { mockPush, mockReplace, mockNearby, mockSave, mockRedirectToSignIn } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockNearby: vi.fn(),
  mockSave: vi.fn(),
  mockRedirectToSignIn: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));
vi.mock("@/app/actions/course", () => ({ fetchNearbyPoisAction: mockNearby }));
vi.mock("@/app/actions/completion", () => ({ saveCourseCompletionAction: mockSave }));
vi.mock("@/client/redirectToSignIn", () => ({ redirectToSignIn: mockRedirectToSignIn }));

function place(id: string, coord: JourneyPlace["coord"] = null): JourneyPlace {
  return {
    id,
    cat: "카페",
    name: `장소 ${id}`,
    addr: "",
    hours: "",
    time: "",
    dur: "",
    badge: { text: "", variant: "accent" },
    desc: "",
    coord,
    imageUrl: null,
    availabilityUncertain: false,
    estimatedDuration: { min: 30, max: 60 },
    tags: [],
  };
}

const DB_A: ResumableCourse = {
  courseId: "db-A",
  completionId: "completion-A",
  courseName: "코스 A",
  scale: "light",
  place: place("A", { lat: 37.5, lng: 127 }),
};

const readStarted = (): StartedCourse | null => {
  const raw = localStorage.getItem("startedCourse");
  return raw ? (JSON.parse(raw) as StartedCourse) : null;
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockNearby.mockResolvedValue({ ok: true, pois: [] });
});

describe("진행 화면 — URL 코스와 로컬 기록 대조", () => {
  it("A 진행 → B 미리보기 → A 이어서: 미리보기 B가 아닌 A를 보여준다", () => {
    localStorage.setItem(
      "pendingCourse",
      JSON.stringify({ courseId: "B", courseName: "코스 B", place: place("B") }),
    );
    const { result } = renderHook(() => useCourseActive("db-A", DB_A, false));

    expect(result.current.status).toBe("ready");
    if (result.current.status === "ready") expect(result.current.place.id).toBe("A");
    // 미리보기는 건드리지 않는다
    expect(JSON.parse(localStorage.getItem("pendingCourse")!).courseId).toBe("B");
  });

  it("다른 코스의 진행 기록이 남아 있어도 URL과 다르면 DB 복원으로 대체한다", () => {
    localStorage.setItem(
      "startedCourse",
      JSON.stringify({ courseId: "X", dbCourseId: "db-X", courseName: "코스 X", place: place("X") }),
    );
    const { result } = renderHook(() => useCourseActive("db-A", DB_A, false));

    if (result.current.status === "ready") expect(result.current.place.id).toBe("A");
    expect(readStarted()?.completionId).toBe("completion-A");
  });

  it("DB로만 복원해도 장소 좌표로 주변 정보를 조회한다", async () => {
    renderHook(() => useCourseActive("db-A", DB_A, false));
    await waitFor(() => expect(mockNearby).toHaveBeenCalledWith(37.5, 127));
  });
});

describe("진행 화면 — 방문 완료 저장 확인", () => {
  const started: StartedCourse = {
    courseId: "A",
    dbCourseId: "db-A",
    completionId: "completion-A",
    courseName: "코스 A",
    place: place("A"),
    startedAt: 1_000,
  };

  it("저장 실패면 완료 화면으로 넘어가지 않고 기록을 보존한 채 오류를 보여준다", async () => {
    localStorage.setItem("startedCourse", JSON.stringify(started));
    mockSave.mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useCourseActive("A", null, false));

    await act(async () => {
      if (result.current.status === "ready") await result.current.handleComplete();
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0]).toMatchObject({
      status: "completed",
      completionId: "completion-A",
      startedAt: 1_000,
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(readStarted()).toMatchObject({ courseId: "A", completionId: "completion-A" });
    expect(readStarted()?.completedAt).toBeUndefined();
    if (result.current.status === "ready") {
      expect(result.current.completeError).not.toBeNull();
      expect(result.current.completing).toBe(false);
    }
  });

  it("통신 실패(예외)도 실패로 처리해 재시도할 수 있다", async () => {
    localStorage.setItem("startedCourse", JSON.stringify(started));
    mockSave.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({
      ok: true,
      completionId: "completion-A",
      dbCourseId: "db-A",
    });
    const { result } = renderHook(() => useCourseActive("A", null, false));

    await act(async () => {
      if (result.current.status === "ready") await result.current.handleComplete();
    });
    expect(mockPush).not.toHaveBeenCalled();

    await act(async () => {
      if (result.current.status === "ready") await result.current.handleComplete();
    });
    expect(mockPush).toHaveBeenCalledWith("/course/done/A");
    expect(readStarted()?.completedAt).toEqual(expect.any(Number));
  });

  it("세션 만료면 로컬 기록을 남긴 채 로그인 화면의 만료 배너로 보낸다", async () => {
    localStorage.setItem("startedCourse", JSON.stringify(started));
    mockSave.mockResolvedValue({ ok: false, reason: "invalid_session" });
    const { result } = renderHook(() => useCourseActive("A", null, false));

    await act(async () => {
      if (result.current.status === "ready") await result.current.handleComplete();
    });

    expect(mockRedirectToSignIn).toHaveBeenCalledWith("session_expired");
    expect(readStarted()?.courseId).toBe("A");
  });

  it("INSERT fallback으로 저장되면 돌려받은 ID를 기록해 이후 저장이 같은 행을 UPDATE한다", async () => {
    // 시작 기록 저장이 실패해 DB ID가 없는 로컬 전용 진행 기록
    localStorage.setItem(
      "startedCourse",
      JSON.stringify({ ...started, completionId: undefined, dbCourseId: undefined }),
    );
    mockSave.mockResolvedValue({ ok: true, completionId: "new-c", dbCourseId: "new-d" });
    const { result } = renderHook(() => useCourseActive("A", null, false));

    await act(async () => {
      if (result.current.status === "ready") await result.current.handleComplete();
    });

    expect(readStarted()).toMatchObject({ completionId: "new-c", dbCourseId: "new-d" });
  });
});

describe("완료 화면 — 후기 저장", () => {
  const completed: StartedCourse = {
    courseId: "A",
    dbCourseId: "db-A",
    completionId: "completion-A",
    courseName: "코스 A",
    place: place("A"),
    completedAt: 2_000,
  };

  it("후기 저장 실패면 기록을 보존하고 홈으로 이동하지 않는다", async () => {
    localStorage.setItem("startedCourse", JSON.stringify(completed));
    mockSave.mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useCourseDone("A"));

    act(() => result.current.setStars(4));
    await act(async () => result.current.handleReview());

    expect(mockSave.mock.calls[0][0]).toMatchObject({ rating: 4, completedAt: 2_000 });
    expect(mockPush).not.toHaveBeenCalled();
    expect(readStarted()?.courseId).toBe("A");
    expect(result.current.saveError).not.toBeNull();
  });

  it("후기 저장 성공 후에만 로컬 기록을 정리하고 홈으로 이동한다", async () => {
    localStorage.setItem("startedCourse", JSON.stringify(completed));
    mockSave.mockResolvedValue({ ok: true, completionId: "completion-A", dbCourseId: "db-A" });
    const { result } = renderHook(() => useCourseDone("A"));

    act(() => result.current.setStars(5));
    await act(async () => result.current.handleReview());

    expect(readStarted()).toBeNull();
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("방문 완료가 이미 저장됐으면 그냥 넘기기는 서버 호출 없이 정리한다", () => {
    localStorage.setItem("startedCourse", JSON.stringify(completed));
    const { result } = renderHook(() => useCourseDone("A"));

    act(() => result.current.handleSkip());

    expect(mockSave).not.toHaveBeenCalled();
    expect(readStarted()).toBeNull();
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("URL 코스와 일치하는 기록이 없으면 임의 장소를 띄우지 않고 홈으로 돌려보낸다", async () => {
    localStorage.setItem("startedCourse", JSON.stringify({ ...completed, courseId: "B", dbCourseId: "db-B" }));
    const { result } = renderHook(() => useCourseDone("A"));

    expect(result.current.place).toBeNull();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
  });
});
