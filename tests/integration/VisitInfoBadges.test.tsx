import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VisitInfoBadges } from "@/components/domains/course/VisitInfoBadges";
import { renderWithClient } from "@/tests/utils";

const { mockFetchBarrierFreeAction, mockFetchPetTourAction } = vi.hoisted(() => ({
  mockFetchBarrierFreeAction: vi.fn(),
  mockFetchPetTourAction: vi.fn(),
}));
vi.mock("@/app/actions/course", () => ({
  fetchBarrierFreeAction: mockFetchBarrierFreeAction,
  fetchPetTourAction: mockFetchPetTourAction,
}));

describe("VisitInfoBadges", () => {
  beforeEach(() => {
    mockFetchBarrierFreeAction.mockReset();
    mockFetchPetTourAction.mockReset();
  });

  it("TourAPI contentid가 아닌 장소(카카오 출처)는 조회하지 않고 아무것도 렌더하지 않는다", () => {
    const { container } = renderWithClient(<VisitInfoBadges placeId="kakao_123" />);

    expect(mockFetchBarrierFreeAction).not.toHaveBeenCalled();
    expect(mockFetchPetTourAction).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it("무장애·반려동물 정보가 둘 다 없으면 블록을 렌더하지 않는다", async () => {
    mockFetchBarrierFreeAction.mockResolvedValue([]);
    mockFetchPetTourAction.mockResolvedValue(null);
    const { container } = renderWithClient(<VisitInfoBadges placeId="3458416" />);

    await waitFor(() => {
      expect(mockFetchBarrierFreeAction).toHaveBeenCalledWith({ contentId: "3458416" });
      expect(mockFetchPetTourAction).toHaveBeenCalledWith({ contentId: "3458416" });
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("무장애 그룹과 반려동물을 제목 하나 아래 줄로 함께 보여준다", async () => {
    mockFetchBarrierFreeAction.mockResolvedValue([
      { group: "mobility", labels: ["장애인 주차", "장애인 화장실"] },
      { group: "visual", labels: ["보조견 동반"] },
    ]);
    mockFetchPetTourAction.mockResolvedValue({
      zone: "partial",
      sizeLabel: "10kg 이하",
      needLabels: ["목줄 착용"],
    });
    renderWithClient(<VisitInfoBadges placeId="3458416" />);

    expect(await screen.findByText("알아두면 좋아요")).toBeInTheDocument();
    expect(screen.getAllByRole("region")).toHaveLength(1);
    expect(screen.getByText("휠체어·이동")).toBeInTheDocument();
    expect(screen.getByText("장애인 화장실")).toBeInTheDocument();
    expect(screen.getByText("보조견 동반")).toBeInTheDocument();
    expect(screen.getByText("반려동물")).toBeInTheDocument();
    expect(screen.getByText("일부 구역만")).toBeInTheDocument();
    expect(screen.getByText("10kg 이하")).toBeInTheDocument();
    expect(screen.getByText("목줄 착용")).toBeInTheDocument();
  });

  it("한쪽 정보만 있으면 그 줄만 보여준다", async () => {
    mockFetchBarrierFreeAction.mockResolvedValue([]);
    mockFetchPetTourAction.mockResolvedValue({ zone: "all", sizeLabel: null, needLabels: [] });
    renderWithClient(<VisitInfoBadges placeId="3458416" />);

    expect(await screen.findByText("전 구역 동반")).toBeInTheDocument();
    expect(screen.queryByText("휠체어·이동")).not.toBeInTheDocument();
  });

  it("한쪽 조회가 끝나지 않았으면 블록을 미리 띄우지 않는다", async () => {
    mockFetchBarrierFreeAction.mockResolvedValue([{ group: "visual", labels: ["보조견 동반"] }]);
    mockFetchPetTourAction.mockReturnValue(new Promise(() => {}));
    const { container } = renderWithClient(<VisitInfoBadges placeId="3458416" />);

    await waitFor(() => expect(mockFetchBarrierFreeAction).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });
});
