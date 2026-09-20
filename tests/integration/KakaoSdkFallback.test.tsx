import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CourseMap } from "@/components/domains/course/CourseMap";
import { NearbyRestaurants } from "@/components/domains/course/NearbyRestaurants";

// 카카오 지도 SDK 스크립트가 로드에 실패한 상황 — jsdom에는 window.kakao가 없다.
// react-kakao-maps-sdk는 SDK가 있어야만 렌더되는 지도 컴포넌트라, 여기까지 오면 안 된다.
vi.mock("react-kakao-maps-sdk", () => ({
  Map: () => {
    throw new Error("SDK 없이 지도를 렌더하면 안 된다");
  },
  MapMarker: () => null,
  CustomOverlayMap: () => null,
}));

const COORD = { lat: 37.5, lng: 127 };

describe("카카오 지도 SDK 로드 실패", () => {
  it("코스 진행 화면 지도(풀 모드)는 실패 안내와 카카오맵 웹 링크를 보여준다", () => {
    render(<CourseMap mainPlace={{ name: "테스트 공원", coord: COORD }} pois={[]} />);

    expect(screen.getByText("지도를 불러오지 못했어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "카카오맵에서 보기" })).toHaveAttribute(
      "href",
      `https://map.kakao.com/link/map/${encodeURIComponent("테스트 공원")},37.5,127`,
    );
  });

  it("코스 추천 화면 지도(bare 모드)는 안내만 보여준다(링크는 화면이 이미 얹어둠)", () => {
    render(<CourseMap mainPlace={{ name: "테스트 공원", coord: COORD }} />);

    expect(screen.getByText("지도를 불러오지 못했어요")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "카카오맵에서 보기" })).not.toBeInTheDocument();
  });

  it("근처 맛집은 로딩에 머물지 않고 카카오맵 검색 대안 링크로 넘어간다", () => {
    render(<NearbyRestaurants placeName="테스트 공원" addr="서울 중구 세종대로 110" coord={COORD} />);

    expect(screen.getByText("테스트 공원 주변 음식점 보기")).toBeInTheDocument();
  });
});
