"use server";

import { nanoid } from "nanoid";
import {
  generateCourse,
  getSearchRadiusM,
  generateCourseFromPlace,
} from "@/lib/pipeline";
import type { PlaceAvailability } from "@/lib/pipeline";
import {
  prefsToProfile,
  coursePlaceToJourneyPlace,
  courseResultToFestivalSummaries,
} from "@/lib/tour/mappers";
import { fetchNearby } from "@/lib/clients/kakao-local";
import type { NearbyCategoryCode } from "@/lib/clients/kakao-local";
import type {
  JourneyPlace,
  NearbyCategory,
  NearbyPoi,
  FestivalSummary,
} from "@/shared/types/course.types";

type Scale = "light" | "moderate" | "leisurely";

interface GenerateCoursePayload {
  mapX: number;
  mapY: number;
  scale: Scale;
  prefs: {
    travel: string;
    party: string;
    vibe: string;
    food: string;
    indoor: string;
  };
  excludeIds?: string[];
  // 검색 반경(m) 오버라이드 — NoNearbyView의 반경 확장 재시도용
  radiusM?: number;
}

type GenerateCourseResult =
  | {
      ok: true;
      courseId: string;
      place: JourneyPlace;
      courseName: string;
      festivals: FestivalSummary[];
    }
  // NO_PLACE: 반경 내 적합한 장소 없음 — radiusM은 실제 검색에 사용된 반경
  | { ok: false; code: "NO_PLACE"; error: string; radiusM: number }
  | { ok: false; code: "UNKNOWN"; error: string };

const NEARBY_CAT_CODE: Record<Exclude<NearbyCategory, "all">, NearbyCategoryCode> = {
  cafe:        "CE7",
  convenience: "CS2",
  pharmacy:    "PM9",
  restaurant:  "FD6",
  parking:     "PK6",
  gas_station: "OL7",
};

type FetchNearbyPoisResult =
  | { ok: true; pois: NearbyPoi[] }
  | { ok: false; error: string };

export async function fetchNearbyPoisAction(
  lat: number,
  lng: number,
): Promise<FetchNearbyPoisResult> {
  try {
    const entries = Object.entries(NEARBY_CAT_CODE) as [
      Exclude<NearbyCategory, "all">,
      NearbyCategoryCode,
    ][];
    const results = await Promise.all(
      entries.map(async ([cat, code]) => {
        const places = await fetchNearby(lat, lng, code, 500).catch((e) => {
          console.error(`[nearby] ${cat}(${code}) 실패:`, e);
          return [];
        });
        return places
          .filter((p) => p.x && p.y)
          .map((p): NearbyPoi => ({
            id:       p.id,
            category: cat,
            name:     p.place_name,
            dist:     `${p.distance}m`,
            isOpen:   true,
            coord:    { lat: parseFloat(p.y), lng: parseFloat(p.x) },
            placeUrl: p.place_url,
          }));
      }),
    );
    const pois = results.flat();
    pois.sort((a, b) => parseInt(a.dist) - parseInt(b.dist));
    return { ok: true, pois };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "조회 실패" };
  }
}

export async function generateCourseAction(
  payload: GenerateCoursePayload,
): Promise<GenerateCourseResult> {
  try {
    const { mapX, mapY, scale, prefs, excludeIds, radiusM } = payload;
    const profile = {
      ...prefsToProfile(prefs, { mapX, mapY }, scale),
      radiusOverrideM: radiusM,
    };
    const { course } = await generateCourse(profile, { excludeIds });

    if (!course.mainPlace) {
      return {
        ok: false,
        code: "NO_PLACE",
        error: "주변에 적합한 장소를 찾지 못했습니다.",
        radiusM: getSearchRadiusM(profile),
      };
    }

    const courseId = nanoid();
    const place = coursePlaceToJourneyPlace(course.mainPlace);
    const courseName = course.mainPlace.title;
    const festivals = courseResultToFestivalSummaries(course);

    return { ok: true, courseId, place, courseName, festivals };
  } catch (err) {
    const message = err instanceof Error ? err.message : "추천 중 오류가 발생했어요.";
    return { ok: false, code: "UNKNOWN", error: message };
  }
}

interface GenerateCourseFromPlacePayload {
  contentId: string;
  contentTypeId: string;
  lat: number;
  lng: number;
}

type GenerateCourseFromPlaceActionResult =
  | {
      ok: true;
      courseId: string;
      place: JourneyPlace;
      courseName: string;
      festivals: FestivalSummary[];
      availability: PlaceAvailability;
    }
  | { ok: false; code: "NOT_FOUND"; error: string }
  | { ok: false; code: "UNKNOWN"; error: string };

// 홈 지역 인기 장소 카드에서 사용자가 직접 고른 장소로 코스를 만든다 (7-A 데이터 층).
// generateCourseAction과 동일한 반환 형태(courseId/place/courseName/festivals)를
// 유지해 프리뷰 화면(CourseResultView)을 그대로 재사용할 수 있게 하고, availability를
// 추가로 얹는다. place.origin="selected"로 진입 경로를 구분한다.
export async function generateCourseFromPlaceAction(
  payload: GenerateCourseFromPlacePayload,
): Promise<GenerateCourseFromPlaceActionResult> {
  const result = await generateCourseFromPlace(payload);

  if (!result.ok) {
    return result;
  }

  const courseId = nanoid();
  const place = coursePlaceToJourneyPlace(result.mainPlace);
  const courseName = result.mainPlace.title;
  const festivals = courseResultToFestivalSummaries({ festivals: result.festivals });

  return {
    ok: true,
    courseId,
    place,
    courseName,
    festivals,
    availability: result.availability,
  };
}
