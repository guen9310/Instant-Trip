import { fetchAreaBasedList } from "@/lib/tour/areaBasedList";
import { fetchNearbyFestivals } from "@/lib/pipeline/festival";
import { festivalsToSummaries } from "@/lib/tour/mappers";
import type { Region } from "@/lib/tour/regionMap";
import type { TourItem } from "@/lib/tour/types";
import type { FestivalSummary } from "@/shared/types/course.types";

const TARGET_CONTENT_TYPES = ["12", "14", "28"] as const;
// 화면 미확정이므로 타입당 10건으로 시작 — UI 완성 후 조정
export const PLACES_PER_TYPE = 10;
// 좌표 기준 축제 탐색 반경 (km) — 즉흥 나들이 앱 맥락상 20km 이내로 한정
export const FESTIVAL_RADIUS_KM = 20;
// 홈 축제 섹션 최대 카드 수 (진행중 먼저, 나머지 예정으로 채움)
export const FESTIVAL_MAX_CARDS = 6;

export type HomeData = {
  region: Region | null;
  places: TourItem[];
  ongoingFestivals: FestivalSummary[];
  upcomingFestivals: FestivalSummary[];
  // 데이터를 반환하지 못한 필드 목록 — "places" | "festivals" | "region"
  errors: string[];
};

// 두 액션이 공유하는 코어 함수 — 좌표 + Region(또는 null)을 받아 HomeData를 반환
export async function fetchHomeCore(
  lat: number,
  lng: number,
  region: Region | null,
): Promise<HomeData> {
  const errors: string[] = [];

  // 장소 목록 — areaCode가 없으면 빈 배열 반환 후 errors에 표시
  const places: TourItem[] = [];
  if (region) {
    try {
      const results = await Promise.all(
        TARGET_CONTENT_TYPES.map((typeId) =>
          fetchAreaBasedList(region.areaCode, typeId, "R", 1, PLACES_PER_TYPE),
        ),
      );
      const seen = new Set<string>();
      for (const items of results) {
        for (const item of items) {
          if (!seen.has(item.contentid)) {
            seen.add(item.contentid);
            places.push(item);
          }
        }
      }
      console.log(`[home] 장소 수집 완료 — ${places.length}건 (${region.name})`);
    } catch (err) {
      console.warn(`[home] 장소 조회 실패 — ${err}`);
      errors.push("places");
    }
  } else {
    console.log("[home] region 없음 — 장소 조회 스킵");
    errors.push("places");
  }

  // 축제 — 좌표만 있으면 항상 시도
  let ongoingFestivals: FestivalSummary[] = [];
  let upcomingFestivals: FestivalSummary[] = [];
  try {
    const raw = await fetchNearbyFestivals(lat, lng, FESTIVAL_RADIUS_KM);
    const summaries = festivalsToSummaries(raw);
    // 진행중 먼저, 나머지 슬롯을 예정으로 채워 최대 FESTIVAL_MAX_CARDS장
    ongoingFestivals = summaries.ongoing.slice(0, FESTIVAL_MAX_CARDS);
    const remainingSlots = FESTIVAL_MAX_CARDS - ongoingFestivals.length;
    upcomingFestivals = summaries.upcoming.slice(0, remainingSlots);
  } catch (err) {
    console.warn(`[home] 축제 조회 실패 — ${err}`);
    errors.push("festivals");
  }

  return { region, places, ongoingFestivals, upcomingFestivals, errors };
}
