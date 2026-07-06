"use server";

import { nanoid } from "nanoid";
import { generateCourse } from "@/lib/pipeline";
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
}

type GenerateCourseResult =
  | {
      ok: true;
      courseId: string;
      place: JourneyPlace;
      courseName: string;
      festivals: FestivalSummary[];
    }
  | { ok: false; error: string };

const COURSE_SUFFIX: Record<Scale, string> = {
  light:     " 산책",
  moderate:  " 코스",
  leisurely: " 하루 코스",
};

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
    const { mapX, mapY, scale, prefs, excludeIds } = payload;
    const profile = prefsToProfile(prefs, { mapX, mapY }, scale);
    const { course } = await generateCourse(profile, { excludeIds });

    if (!course.mainPlace) {
      return { ok: false, error: "주변에 적합한 장소를 찾지 못했습니다." };
    }

    const courseId = nanoid();
    const place = coursePlaceToJourneyPlace(course.mainPlace);
    const courseName = course.mainPlace.title + COURSE_SUFFIX[scale];
    const festivals = courseResultToFestivalSummaries(course);

    return { ok: true, courseId, place, courseName, festivals };
  } catch (err) {
    const message = err instanceof Error ? err.message : "코스 생성 중 오류가 발생했습니다.";
    return { ok: false, error: message };
  }
}
