"use server";

import { nanoid } from "nanoid";
import {
  generateCourse,
  getSearchRadiusM,
  generateCourseFromPlace,
  generateCourseFromFestival,
} from "@/lib/pipeline";
import type { PlaceAvailability } from "@/lib/pipeline";
import {
  prefsToProfile,
  coursePlaceToJourneyPlace,
  courseResultToFestivalSummaries,
} from "@/lib/tour/mappers";
import { fetchNearby } from "@/lib/clients/kakaoLocal";
import type { NearbyCategoryCode } from "@/lib/clients/kakaoLocal";
import { getAuthState } from "@/server/session";
import { getRecentlyVisitedCoords } from "@/server/queries";
import type {
  JourneyPlace,
  NearbyCategory,
  NearbyPoi,
  FestivalSummary,
} from "@/shared/types/course.types";
import {
  generateCourseFromFestivalInputSchema,
  generateCourseFromPlaceInputSchema,
  generateCourseInputSchema,
  nearbyPoisInputSchema,
} from "@/shared/schemas/actionInputs";
import type { AuthFailureReason } from "@/shared/types/auth.types";

// "이미 가봤어요" 쿨다운 — 이 기간 내 완료한 장소는 재추천 후보에서 제외한다.
// 카테고리별 차등화(카페는 짧게, 관광지는 길게)는 1차 범위 밖 — 단일 값으로 시작한다.
const VISITED_COOLDOWN_DAYS = 30;

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
  // UNAUTHENTICATED: /start(보호 경로)가 이 액션의 유일한 호출부라, proxy.ts가
  // 더 이상 서버 액션 요청 자체를 막지 않는 대신(막으면 클라이언트 액션 호출부가
  // 리다이렉트 응답을 파싱하지 못해 무한 로딩에 빠진다) 이 액션이 직접 판별한다.
  | { ok: false; code: "UNAUTHENTICATED"; reason: AuthFailureReason }
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
  const parsed = nearbyPoisInputSchema.safeParse({ lat, lng });
  if (!parsed.success) {
    return { ok: false, error: "잘못된 위치 정보입니다." };
  }

  try {
    const entries = Object.entries(NEARBY_CAT_CODE) as [
      Exclude<NearbyCategory, "all">,
      NearbyCategoryCode,
    ][];
    const results = await Promise.all(
      entries.map(async ([cat, code]) => {
        const places = await fetchNearby(
          parsed.data.lat,
          parsed.data.lng,
          code,
          500,
        ).catch((e) => {
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

    // 카카오 로컬 DB에 같은 자리 상호가 개명 등으로 구·신 등록 정보가 둘 다 남아있는
    // 경우가 있다 — place id는 다르지만 좌표가 완전히 같은 별개 문서로 잡힌다(실사용
    // 확인: 울산 삼산동 한 좌표에 "레드버튼"·"벌턴 파리지앙"이 동일 좌표로 중복 등록).
    // 그대로 두면 지도 클러스터 배지 숫자가 실제 장소 수보다 부풀려진다.
    const seenCoordKeys = new Set<string>();
    const dedupedPois = pois.filter((p) => {
      const key = `${p.coord.lat.toFixed(5)},${p.coord.lng.toFixed(5)}`;
      if (seenCoordKeys.has(key)) return false;
      seenCoordKeys.add(key);
      return true;
    });

    return { ok: true, pois: dedupedPois };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "조회 실패" };
  }
}

export async function generateCourseAction(
  input: unknown,
): Promise<GenerateCourseResult> {
  const authState = await getAuthState();
  if (authState.status !== "authenticated") {
    return { ok: false, code: "UNAUTHENTICATED", reason: authState.status };
  }

  const parsed = generateCourseInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "UNKNOWN", error: "잘못된 추천 요청입니다." };
  }

  try {
    const { mapX, mapY, scale, prefs, excludeIds, radiusM, maxDistanceKm, strictOpenOnly } =
      parsed.data;
    const profile = {
      ...prefsToProfile(prefs, { mapX, mapY }, scale),
      radiusOverrideM: radiusM,
    };
    const cooldownSince = new Date(Date.now() - VISITED_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    const excludeCoords = await getRecentlyVisitedCoords(
      authState.session.user.id,
      cooldownSince,
    );
    const { course } = await generateCourse(profile, {
      excludeIds,
      excludeCoords,
      maxDistanceKm,
      strictOpenOnly,
    });

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
  input: unknown,
): Promise<GenerateCourseFromPlaceActionResult> {
  const parsed = generateCourseFromPlaceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "UNKNOWN", error: "잘못된 장소 요청입니다." };
  }
  const result = await generateCourseFromPlace(parsed.data);

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

type GenerateCourseFromFestivalActionResult =
  | {
      ok: true;
      courseId: string;
      place: JourneyPlace;
      courseName: string;
      festivals: FestivalSummary[];
      availability: PlaceAvailability;
    }
  | { ok: false; code: "UNKNOWN"; error: string };

// 홈 "주변 축제" 카드에서 사용자가 직접 고른 축제로 코스를 만든다 — generateCourseFromPlaceAction과
// 대응되는 축제 버전이다. 반환 형태를 동일하게 유지해 프리뷰 화면(CourseResultView)을
// 그대로 재사용한다. payload는 FestivalSummary 그대로 받는다 — 홈 화면이 이미 갖고 있는
// 필드만으로 CoursePlace를 조립하므로(공공데이터포털 단독 축제는 재조회 자체가 불가능),
// 클라이언트가 별도 변환 없이 넘길 수 있게 한다.
export async function generateCourseFromFestivalAction(
  input: unknown,
): Promise<GenerateCourseFromFestivalActionResult> {
  const parsed = generateCourseFromFestivalInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "UNKNOWN", error: "잘못된 축제 요청입니다." };
  }
  const payload = parsed.data;
  const result = await generateCourseFromFestival({
    id: payload.id,
    contentId: payload.contentId,
    name: payload.name,
    address: payload.address,
    lat: payload.lat,
    lng: payload.lng,
    startDate: payload.startDate,
    endDate: payload.endDate,
    description: payload.description,
    imageUrl: payload.imageUrl,
  });

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
