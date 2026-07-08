// 체류시간 범위(분). TourAPI에 체류시간 데이터가 없어 카테고리별 상수에서 파생한다.
// 단일 값은 임의 데이터임에도 정확해 보이므로, 범위로 표기해 부정확함을 흡수한다.
export type DurationRange = { min: number; max: number };

// 분 → 표시 문자열. 60분 이상은 시간 단위로 렌더링한다. (90 → "1시간 30분")
function formatMin(m: number): string {
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}시간` : `${h}시간 ${r}분`;
}

// 체류시간 범위 표시 문자열. min과 max가 다르면 "1시간~1시간 30분 정도", 같으면 "보통 1시간 정도".
export function formatDuration(range: DurationRange): string {
  if (range.min !== range.max)
    return `${formatMin(range.min)}~${formatMin(range.max)} 정도`;
  return `보통 ${formatMin(range.max)} 정도`;
}
