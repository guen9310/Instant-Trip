"use server";

export async function fetchCityAction(
  lat: number,
  lon: number,
): Promise<string> {
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
    return "현재 위치";
  }

  const data = await res.json();
  console.log("[geocode] raw address:", data.address);
  const a = data.address ?? {};
  return (
    a.quarter ||
    a.suburb ||
    a.village ||
    a.town ||
    a.city_district ||
    a.borough ||
    a.city ||
    a.county ||
    a.state ||
    "현재 위치"
  );
}
