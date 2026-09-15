import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BarrierFreeBadges } from "@/components/domains/course/BarrierFreeBadges";
import { renderWithClient } from "@/tests/utils";

const { mockFetchBarrierFreeAction } = vi.hoisted(() => ({
  mockFetchBarrierFreeAction: vi.fn(),
}));
vi.mock("@/app/actions/course", () => ({
  fetchBarrierFreeAction: mockFetchBarrierFreeAction,
}));

describe("BarrierFreeBadges", () => {
  beforeEach(() => {
    mockFetchBarrierFreeAction.mockReset();
  });

  it("TourAPI contentid가 아닌 장소(카카오 출처)는 조회하지 않고 아무것도 렌더하지 않는다", () => {
    const { container } = renderWithClient(<BarrierFreeBadges placeId="kakao_123" />);

    expect(mockFetchBarrierFreeAction).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it("무장애 정보가 없으면 섹션을 렌더하지 않는다", async () => {
    mockFetchBarrierFreeAction.mockResolvedValue([]);
    const { container } = renderWithClient(<BarrierFreeBadges placeId="130183" />);

    await waitFor(() =>
      expect(mockFetchBarrierFreeAction).toHaveBeenCalledWith({ contentId: "130183" }),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("그룹별 배지를 중복 없이 보여주고, 자세히를 누르면 원문 상세를 펼친다", async () => {
    mockFetchBarrierFreeAction.mockResolvedValue([
      {
        group: "mobility",
        facilities: [
          { labels: ["휠체어 접근"], name: "접근로", detail: "출입구까지 턱이 없음" },
          { labels: ["휠체어 접근"], name: "출입통로", detail: "주출입구 자동문" },
          { labels: ["장애인 화장실"], name: "화장실", detail: "장애인 화장실 있음" },
        ],
      },
      {
        group: "hearing",
        facilities: [{ labels: [], name: "기타", detail: "관람 전 문의 필요" }],
      },
    ]);
    const user = userEvent.setup();
    renderWithClient(<BarrierFreeBadges placeId="130183" />);

    expect(await screen.findByText("무장애 편의시설")).toBeInTheDocument();
    expect(screen.getAllByText("휠체어 접근")).toHaveLength(1);
    expect(screen.getByText("장애인 화장실")).toBeInTheDocument();
    expect(screen.getByText("안내 사항 있음")).toBeInTheDocument();
    expect(screen.queryByText("주출입구 자동문")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "자세히" }));

    expect(screen.getByText("주출입구 자동문")).toBeInTheDocument();
    expect(screen.getByText("관람 전 문의 필요")).toBeInTheDocument();
  });
});
