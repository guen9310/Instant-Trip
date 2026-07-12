"use server";

export type GeocodedCity = {
  displayName: string;  // 화면 표시용 — suburb/quarter 수준의 상세 이름
  sidoName: string | null; // resolveRegion에 넣을 시·도 레벨 이름
};

export async function fetchCityAction(
  lat: number,
  lon: number,
): Promise<GeocodedCity> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
    {
      headers: {
        "Accept-Language": "ko",
        "User-Agent": "untitle-app/1.0",
      },
    },
  );

  if (!res.ok) {
    console.log("[geocode] HTTP error:", res.status, res.statusText);
    return { displayName: "현재 위치", sidoName: null };
  }

  const data = await res.json();
  console.log("[geocode] raw address:", data.address);
  const a = data.address ?? {};

  const displayName =
    a.quarter ||
    a.suburb ||
    a.village ||
    a.town ||
    a.city_district ||
    a.borough ||
    a.city ||
    a.county ||
    a.state ||
    "현재 위치";

  // 도 지역: province 필드가 시·도명 (경기도, 강원특별자치도, 충청북도 등)
  // 광역시/특별시/특별자치시: province 없고 city 자체가 시·도명 (울산광역시, 서울특별시, 세종특별자치시)
  const sidoName: string | null =
    a.province ||
    (a.city && /광역시|특별시|특별자치시/.test(a.city) ? a.city : null);

  console.log("[geocode] sidoName:", sidoName);
  return { displayName, sidoName };
}
