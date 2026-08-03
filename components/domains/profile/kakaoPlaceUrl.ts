// 카카오 로컬 출처 장소는 실제 place.map.kakao.com 상세 페이지로 연결한다.
// 그 외(TourAPI 출처 등 placeUrl이 없는 경우)는 CourseActiveView의 "길찾기"와 동일하게
// 좌표 기반 map.kakao.com/link/map 링크로 폴백한다 — 이름+좌표만 있으면 출처 무관하게
// 정확히 동작해서, 텍스트 검색보다 신뢰도가 높다. 좌표조차 없는 아주 오래된 데이터만
// 최후 수단으로 이름+주소 검색 링크를 쓴다.
export function kakaoPlaceUrl(place: {
  name: string;
  address: string;
  coord: { lat: number; lng: number } | null;
  placeUrl: string | null;
}): string {
  if (place.placeUrl) return place.placeUrl;
  if (place.coord) {
    return `https://map.kakao.com/link/map/${encodeURIComponent(place.name)},${place.coord.lat},${place.coord.lng}`;
  }
  const query = place.address ? `${place.name} ${place.address}` : place.name;
  return `https://map.kakao.com/?q=${encodeURIComponent(query)}`;
}
