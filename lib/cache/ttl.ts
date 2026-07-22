export const TTL = {
  LOCATION_BASED_LIST: 6 * 60 * 60,  // 6h
  AREA_BASED_LIST:     6 * 60 * 60,  // 6h
  DETAIL_INTRO:        24 * 60 * 60, // 24h
  DETAIL_COMMON:       24 * 60 * 60, // 24h
  DETAIL_IMAGE:        24 * 60 * 60, // 24h
  FESTIVAL:            6 * 60 * 60,  // 6h — 공공데이터포털 전국문화축제
  TOUR_FESTIVAL:       6 * 60 * 60,  // 6h — Tour API searchFestival2
  EMPTY_RESULT:        1 * 60 * 60,  // 1h — 빈 결과 단기 캐시
  WEATHER_NCST:        2 * 60 * 60,  // 2h — 키에 발표시각(base_time)이 포함되어 정합성과 무관, 정리 주기용 여유값
} as const
