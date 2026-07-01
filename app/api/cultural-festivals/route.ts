import { fetchNearbyFestivals, fetchAllFestivalsByDate } from "@/lib/pipeline/festival";

// GET /api/cultural-festivals?lat={lat}&lng={lng}&radius={radiusKm}
// lat/lng를 생략하면 위치 필터링 없이 전국 데이터를 날짜 기준으로만 분류해 반환한다.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const radius = searchParams.get("radius");

  const { ongoing, upcoming } =
    lat !== null && lng !== null
      ? await fetchNearbyFestivals(
          parseFloat(lat),
          parseFloat(lng),
          radius !== null ? parseFloat(radius) : 20,
        )
      : await fetchAllFestivalsByDate();

  return Response.json({
    ok: true,
    ongoing,
    upcoming,
    totalCount: ongoing.length + upcoming.length,
  });
}
