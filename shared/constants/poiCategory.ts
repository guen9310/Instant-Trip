import type { NearbyCategory } from "@/shared/types/course.types";

export type PoiCategory = Exclude<NearbyCategory, "all">;

// CourseActiveView(CATEGORY_META)·CourseMap(마커/클러스터 배지/범례)이 함께 참조하는
// 카테고리 순서·라벨·색상의 단일 출처. 색상은 app/globals.css 라이트 테마 토큰(accent/point/
// primary) 및 Tailwind 팔레트(orange/sky/yellow-500)를 그대로 미러링한 hex 값이다 — 지도
// 마커가 data URI라 CSS 변수를 못 받는 사정 때문에 hex로 고정한다.
export const POI_CATEGORY_ORDER: PoiCategory[] = [
  "cafe",
  "convenience",
  "pharmacy",
  "restaurant",
  "parking",
  "gas_station",
];

export const POI_CATEGORY_LABEL: Record<PoiCategory, string> = {
  cafe: "카페",
  convenience: "편의점",
  pharmacy: "약국",
  restaurant: "음식점",
  parking: "주차장",
  gas_station: "주유소",
};

export const POI_CATEGORY_COLOR: Record<PoiCategory, string> = {
  cafe: "#3d7a6b", // accent
  convenience: "#e8936a", // point
  pharmacy: "#243b55", // primary
  restaurant: "#F97316", // orange-500
  parking: "#0EA5E9", // sky-500
  gas_station: "#EAB308", // yellow-500
};
