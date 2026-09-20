import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NearbyPanel } from "@/components/domains/course/NearbyPanel";
import { StarRating } from "@/components/domains/profile/StarRating";
import type { NearbyPoi } from "@/shared/types/course.types";

vi.mock("react-kakao-maps-sdk", () => ({ Map: () => null, MapMarker: () => null, CustomOverlayMap: () => null }));

const POI: NearbyPoi = {
  id: "c1",
  category: "cafe",
  name: "골목 카페",
  dist: "40m",
  coord: { lat: 37.5, lng: 127 },
  placeUrl: "https://place.map.kakao.com/1",
};

describe("접근성 — 주변 정보·별점", () => {
  it("주변 장소 선택 버튼 안에 링크가 중첩되지 않고, 링크에 이름이 있다", () => {
    render(
      <NearbyPanel
        placeName="테스트 공원"
        placeCoord={null}
        cat="all"
        setCat={() => {}}
        pois={[POI]}
        loading={false}
        selectedPoiId={null}
        onSelect={() => {}}
      />,
    );

    const select = screen.getByRole("button", { name: /골목 카페/ });
    expect(within(select).queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "골목 카페 카카오맵에서 보기" })).toHaveAttribute(
      "href",
      POI.placeUrl,
    );
  });

  it("읽기 전용 별점은 점수 하나로 읽힌다", () => {
    render(<StarRating rating={4} />);
    expect(screen.getByRole("img", { name: "별점 4점" })).toBeInTheDocument();
  });
});
