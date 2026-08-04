import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CourseResultView } from "@/components/domains/course/CourseResultView";
import { useCourseProgressStore } from "@/client/stores/useCourseProgressStore";
import { renderWithClient } from "@/tests/utils";
import type { JourneyPlace } from "@/shared/types/course.types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const { mockStartCourseAction } = vi.hoisted(() => ({
  mockStartCourseAction: vi.fn(),
}));
vi.mock("@/app/actions/completion", () => ({
  startCourseAction: mockStartCourseAction,
}));

const { mockRedirectToSignIn } = vi.hoisted(() => ({
  mockRedirectToSignIn: vi.fn(),
}));
vi.mock("@/client/redirectToSignIn", () => ({
  redirectToSignIn: mockRedirectToSignIn,
}));

// 지도·근처 맛집·썸네일 등 보조 섹션은 coord/imageUrl/desc를 비워 렌더 자체를
// 건너뛰게 한다 — 이 테스트는 인증 상태 분기만 검증하면 되므로 그 섹션들이
// 의존하는 카카오맵 SDK 등을 목업할 필요가 없다.
const PLACE: JourneyPlace = {
  id: "place-1",
  cat: "카페",
  name: "테스트 카페",
  addr: "",
  hours: "",
  time: "",
  dur: "",
  badge: { text: "테스트", variant: "accent" },
  desc: "",
  coord: null,
  imageUrl: null,
  availabilityUncertain: false,
  estimatedDuration: { min: 30, max: 60 },
  tags: [],
};

const BASE_PROPS = {
  courseId: "course-1",
  courseName: "테스트 코스",
  place: PLACE,
  activeCourse: null,
};

describe("CourseResultView — '여기로 갈게요' 인증 상태별 분기 (해피 패스)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockStartCourseAction.mockClear();
    mockRedirectToSignIn.mockClear();
    useCourseProgressStore.getState().reset();
  });

  it("정상 로그인 상태면 낙관적으로 진행 화면에 이동하고 시작 액션을 호출한다", async () => {
    mockStartCourseAction.mockResolvedValue({
      ok: true,
      completionId: "c1",
      dbCourseId: "d1",
    });
    const user = userEvent.setup();
    renderWithClient(
      <CourseResultView {...BASE_PROPS} isAuthenticated sessionExpired={false} />,
    );

    await user.click(screen.getByRole("button", { name: "여기로 갈게요" }));

    expect(mockPush).toHaveBeenCalledWith("/course/active/course-1");
    await waitFor(() => expect(mockStartCourseAction).toHaveBeenCalled());
    expect(mockRedirectToSignIn).not.toHaveBeenCalled();
  });

  it("세션이 무효화된 상태(sessionExpired)면 안내 토스트 없이 곧바로 만료 배너로 보낸다", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <CourseResultView {...BASE_PROPS} isAuthenticated={false} sessionExpired />,
    );

    await user.click(screen.getByRole("button", { name: "여기로 갈게요" }));

    expect(mockRedirectToSignIn).toHaveBeenCalledWith("session_expired");
    expect(mockStartCourseAction).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(
      screen.queryByText("로그인하면 외출을 시작하고 기록할 수 있어요"),
    ).not.toBeInTheDocument();
  });

  it("로그인한 적 없는 상태(anonymous)면 로그인 안내 토스트만 보여주고 곧바로 리다이렉트하지 않는다", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <CourseResultView {...BASE_PROPS} isAuthenticated={false} sessionExpired={false} />,
    );

    await user.click(screen.getByRole("button", { name: "여기로 갈게요" }));

    expect(
      screen.getByText("로그인하면 외출을 시작하고 기록할 수 있어요"),
    ).toBeInTheDocument();
    expect(mockRedirectToSignIn).not.toHaveBeenCalled();
    expect(mockStartCourseAction).not.toHaveBeenCalled();
  });
});
