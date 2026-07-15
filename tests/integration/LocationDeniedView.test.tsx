import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LocationDeniedView } from "@/components/domains/location/LocationDeniedView";

// useLocationStore mock
const mockRequestPermission = vi.fn();
const mockSetCity = vi.fn();
let mockLocationState: { status: string } = { status: "denied" };

vi.mock("@/client/stores/useLocationStore", () => ({
  useLocationStore: () => ({
    requestPermission: mockRequestPermission,
    setCity: mockSetCity,
    state: mockLocationState,
  }),
}));

beforeEach(() => {
  mockRequestPermission.mockReset();
  mockSetCity.mockReset();
  mockLocationState = { status: "denied" };
});

describe("LocationDeniedView", () => {
  it("denied variant에서 위치 권한 거부 알림이 표시된다", () => {
    render(<LocationDeniedView variant="denied" />);
    expect(screen.getByText("위치 권한이 거부되었어요")).toBeInTheDocument();
  });

  it("manual variant에서 거부 알림이 표시되지 않는다", () => {
    render(<LocationDeniedView variant="manual" />);
    expect(screen.queryByText("위치 권한이 거부되었어요")).not.toBeInTheDocument();
  });

  it("[권한 다시 요청] 버튼이 표시된다 (denied 상태)", () => {
    render(<LocationDeniedView />);
    expect(screen.getByRole("button", { name: /권한 다시 요청/ })).toBeInTheDocument();
  });

  it("system-denied 상태에서 [권한 다시 요청] 버튼이 표시되지 않는다", () => {
    mockLocationState = { status: "system-denied" };
    render(<LocationDeniedView variant="denied" />);
    expect(screen.queryByRole("button", { name: /권한 다시 요청/ })).not.toBeInTheDocument();
  });

  it("system-denied 상태에서 브라우저 설정 안내 문구가 표시된다", () => {
    mockLocationState = { status: "system-denied" };
    render(<LocationDeniedView variant="denied" />);
    expect(screen.getByText(/브라우저 설정에서 이 사이트의 위치 권한을 허용/)).toBeInTheDocument();
  });

  it("[지역 선택] 버튼이 표시된다", () => {
    render(<LocationDeniedView />);
    expect(screen.getByRole("button", { name: /지역 선택/ })).toBeInTheDocument();
  });

  it("[권한 다시 요청] 클릭 시 requestPermission이 호출된다", async () => {
    const user = userEvent.setup();
    render(<LocationDeniedView />);
    await user.click(screen.getByRole("button", { name: /권한 다시 요청/ }));
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it("[지역 선택] 클릭 시 RegionSelectSheet가 열리고 17개 시·도가 표시된다", async () => {
    const user = userEvent.setup();
    render(<LocationDeniedView />);
    await user.click(screen.getByRole("button", { name: /지역 선택/ }));

    // RegionSelectSheet는 vaul Drawer로 렌더됨 — portal로 body에 삽입
    await waitFor(() => {
      expect(screen.getByText("서울")).toBeInTheDocument();
    });

    // 17개 시·도 전수 확인
    const regions = [
      "서울", "인천", "대전", "대구", "광주", "부산", "울산",
      "세종", "경기", "강원", "충북", "충남", "경북", "경남",
      "전북", "전남", "제주",
    ];
    for (const name of regions) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("RegionSelectSheet에서 지역 선택 시 setCity가 호출되고 onCitySelect 콜백이 실행된다", async () => {
    const onCitySelect = vi.fn();
    const user = userEvent.setup();
    render(<LocationDeniedView onCitySelect={onCitySelect} />);

    await user.click(screen.getByRole("button", { name: /지역 선택/ }));
    await waitFor(() => expect(screen.getByText("충남")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "충남" }));

    expect(mockSetCity).toHaveBeenCalledWith("충남", "충남", 36.601, 126.661);
    expect(onCitySelect).toHaveBeenCalledWith("충남", "충남");
  });
});
