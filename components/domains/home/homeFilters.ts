// 인기 장소 필터 칩 — HomeView(선택 상태)와 PlacesSection(칩 렌더링)이 공유하는 정의.
export const FILTER_CHIPS = ["전체", "관광지", "문화시설", "레포츠", "음식점"] as const;
export type FilterChip = (typeof FILTER_CHIPS)[number];

export const CHIP_TO_TYPE: Partial<Record<FilterChip, string>> = {
  관광지: "12",
  문화시설: "14",
  레포츠: "28",
  음식점: "39",
};
