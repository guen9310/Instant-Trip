// 체류시간 범위(분). TourAPI에 체류시간 데이터가 없어 카테고리별 상수에서 파생한다.
// 단일 값은 임의 데이터임에도 정확해 보이므로, 범위로 표기해 부정확함을 흡수한다.
export type DurationRange = { min: number; max: number };

// 기존 카테고리별 단일 체류시간(분)을 범위로 변환한다.
// 규칙: 기존 값을 max로, max의 50%를 30분 단위로 내림한 값을 min으로.
// (예: 120 → { min: 60, max: 120 }, 60 → { min: 30, max: 60 })
// 내림 결과가 0이면 범위 표기가 무의미하므로 min=max로 두고 단일 값으로 표기한다.
export function toDurationRange(maxMin: number): DurationRange {
  const min = Math.floor((maxMin * 0.5) / 30) * 30;
  return { min: min > 0 ? min : maxMin, max: maxMin };
}

// 체류시간 범위 표시 문자열. min과 max가 다르면 "60~120분 정도", 같으면 "보통 60분 정도".
export function formatDuration(range: DurationRange): string {
  if (range.min !== range.max) return `${range.min}~${range.max}분 정도`;
  return `보통 ${range.max}분 정도`;
}
