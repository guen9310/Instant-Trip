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

// 다크 테마 변형 — app/globals.css의 .dark 블록과 동일한 라이트→다크 대응을 그대로
// 따른다(accent/point/primary는 .dark의 실제 값을 그대로 미러링). Tailwind 팔레트로
// 고른 나머지 3개(orange/sky/yellow-500)는 .dark 쪽에 대응 토큰이 없어, globals.css가
// 라이트→다크에서 일관되게 밝은 쪽으로 옮기는 패턴(예: accent #3d7a6b→#52a88e)을 따라
// 한 단계 밝은 Tailwind 셰이드(400)를 골랐다 — 어두운 배경(--background: #0f1923)에서
// 대비를 확보하기 위함.
export const POI_CATEGORY_COLOR_DARK: Record<PoiCategory, string> = {
  cafe: "#52a88e", // accent (.dark)
  convenience: "#f0a882", // point (.dark)
  pharmacy: "#5b8db8", // primary (.dark)
  restaurant: "#FB923C", // orange-400
  parking: "#38BDF8", // sky-400
  gas_station: "#FACC15", // yellow-400
};
