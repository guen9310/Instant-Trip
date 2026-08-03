export function extractRegion(addr: string): string {
  const parts = addr.trim().split(/\s+/);
  if (parts.length < 2) return addr;

  const lvl1 = parts[0];

  // 특별시/광역시/특별자치시: "울산광역시 중구 ..." → "울산 중구"
  const metroMatch = lvl1.match(/^(.+?)(?:특별시|광역시|특별자치시)$/);
  if (metroMatch) {
    return `${metroMatch[1]} ${parts[1]}`;
  }

  // 도: "경기도 수원시 영통구 ..." → "수원시 영통구", "강원도 춘천시 ..." → "춘천시"
  if (lvl1.endsWith("도")) {
    if (parts.length >= 3 && /[구군]$/.test(parts[2])) {
      return `${parts[1]} ${parts[2]}`;
    }
    return parts[1];
  }

  return `${parts[0]} ${parts[1]}`;
}
