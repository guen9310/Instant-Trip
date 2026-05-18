import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FeedCourseSheet } from "@/components/domains/feed/FeedCourseSheet";
import type { CourseData } from "@/shared/types/feed.types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
}));

const availableCourse: CourseData = {
  id: "test-1",
  name: "테스트 코스",
  region: "서울 종로구",
  rating: 4.5,
  count: 10,
  availability: "available",
  places: [
    { name: "장소 A", category: "관광지", status: "open" },
    { name: "장소 B", category: "문화시설", status: "open" },
  ],
};

const partialCourse: CourseData = {
  id: "test-2",
  name: "일부 미운영 코스",
  region: "서울 마포구",
  rating: 4.0,
  count: 5,
  availability: "partial",
  places: [
    { name: "열린 장소", category: "관광지", status: "open" },
    { name: "닫힌 장소", category: "문화시설", status: "closed" },
  ],
};

describe("FeedCourseSheet", () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    mockPush.mockClear();
    onOpenChange.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("course가 null이면 아무것도 렌더링하지 않는다", () => {
    const { container } = render(
      <FeedCourseSheet course={null} open={true} onOpenChange={onOpenChange} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("available 코스 → '나도 이 코스 가볼게요' CTA 표시", () => {
    render(
      <FeedCourseSheet course={availableCourse} open={true} onOpenChange={onOpenChange} />,
    );
    expect(screen.getByText("나도 이 코스 가볼게요")).toBeInTheDocument();
    expect(screen.getByText("테스트 코스")).toBeInTheDocument();
  });

  it("partial 코스 → '제외하고 실행' + '취소' 표시", () => {
    render(
      <FeedCourseSheet course={partialCourse} open={true} onOpenChange={onOpenChange} />,
    );
    expect(screen.getByText("제외하고 실행")).toBeInTheDocument();
    expect(screen.getByText("취소")).toBeInTheDocument();
  });

  it("partial 코스에서 '제외하고 실행' → 로딩 → updated 전이", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <FeedCourseSheet course={partialCourse} open={true} onOpenChange={onOpenChange} />,
    );

    await user.click(screen.getByText("제외하고 실행"));

    // loading phase
    expect(screen.getByText("코스를 업데이트하는 중...")).toBeInTheDocument();

    // 컴포넌트 내부 setTimeout(1500)을 건너뜀
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    // updated phase
    expect(screen.getByText("이 코스로 갈게요")).toBeInTheDocument();
  });

  it("available 코스에서 CTA 클릭 시 course active 경로로 이동", async () => {
    const user = userEvent.setup();

    render(
      <FeedCourseSheet course={availableCourse} open={true} onOpenChange={onOpenChange} />,
    );

    await user.click(screen.getByText("나도 이 코스 가볼게요"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockPush).toHaveBeenCalledWith("/course/test-1/active");
  });
});
