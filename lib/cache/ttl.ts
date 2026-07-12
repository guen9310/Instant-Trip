export const TTL = {
  LOCATION_BASED_LIST: 6 * 60 * 60,  // 6h
  DETAIL_INTRO:        24 * 60 * 60, // 24h
  DETAIL_COMMON:       24 * 60 * 60, // 24h
  DETAIL_IMAGE:        24 * 60 * 60, // 24h
  FESTIVAL:            6 * 60 * 60,  // 6h
  EMPTY_RESULT:        1 * 60 * 60,  // 1h — 빈 결과 단기 캐시
} as const
