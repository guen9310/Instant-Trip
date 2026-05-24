import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { LocationDeniedView } from "@/components/domains/location/LocationDeniedView";

describe("LocationDeniedView", () => {
  it("Step1: 5개 권역이 표시된다", () => {
    render(<LocationDeniedView onCitySelect={vi.fn()} />);
    expect(screen.getByText("수도권")).toBeInTheDocument();
    expect(screen.getByText("중부권")).toBeInTheDocument();
    expect(screen.getByText("영남권")).toBeInTheDocument();
    expect(screen.getByText("호남권")).toBeInTheDocument();
    expect(screen.getByText("제주·강원")).toBeInTheDocument();
  });

  it("Step1: denied variant에서 위치 권한 거부 경고가 표시된다", () => {
    render(<LocationDeniedView onCitySelect={vi.fn()} variant="denied" />);
    expect(screen.getByText("위치 권한이 거부되었어요")).toBeInTheDocument();
  });

  it("Step1: manual variant에서 경고 배너가 표시되지 않는다", () => {
    render(<LocationDeniedView onCitySelect={vi.fn()} variant="manual" />);
    expect(screen.queryByText("위치 권한이 거부되었어요")).not.toBeInTheDocument();
  });

  it("권역 선택 시 Step2로 전환되어 도시 목록이 표시된다", async () => {
    const user = userEvent.setup();
    render(<LocationDeniedView onCitySelect={vi.fn()} />);

    await user.click(screen.getByText("수도권"));

    expect(screen.getByText("서울")).toBeInTheDocument();
    expect(screen.getByText("인천")).toBeInTheDocument();
  });

  it("도시 미선택 시 CTA 버튼이 비활성 상태이다", async () => {
    const user = userEvent.setup();
    render(<LocationDeniedView onCitySelect={vi.fn()} />);

    await user.click(screen.getByText("수도권"));

    const disabledBtn = screen.getByRole("button", { name: "도시를 선택해주세요" });
    expect(disabledBtn).toBeDisabled();
  });

  it("도시 선택 시 CTA가 활성화된다", async () => {
    const user = userEvent.setup();
    render(<LocationDeniedView onCitySelect={vi.fn()} />);

    await user.click(screen.getByText("수도권"));
    await user.click(screen.getByText("서울"));

    expect(screen.getByRole("button", { name: "이 도시로 코스 뽑기" })).not.toBeDisabled();
  });

  it("CTA 클릭 시 onCitySelect 콜백이 선택된 도시명으로 호출된다", async () => {
    const onCitySelect = vi.fn();
    const user = userEvent.setup();
    render(<LocationDeniedView onCitySelect={onCitySelect} />);

    await user.click(screen.getByText("수도권"));
    await user.click(screen.getByText("서울"));
    await user.click(screen.getByRole("button", { name: "이 도시로 코스 뽑기" }));

    expect(onCitySelect).toHaveBeenCalledWith("서울");
  });

  it("뒤로가기 시 Step1로 돌아간다", async () => {
    const user = userEvent.setup();
    render(<LocationDeniedView onCitySelect={vi.fn()} />);

    await user.click(screen.getByText("영남권"));
    expect(screen.getByText("부산")).toBeInTheDocument();

    await user.click(screen.getByText("권역 다시 선택"));
    expect(screen.getByText("어느 지역에 계세요?")).toBeInTheDocument();
  });
});
