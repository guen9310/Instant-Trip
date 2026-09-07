"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCourseProgressStore } from "@/client/stores/useCourseProgressStore";
import {
  generateCourseFromPlaceAction,
  generateCourseFromFestivalAction,
} from "@/app/actions/course";
import type { FestivalSummary, JourneyPlace, PendingCourse } from "@/shared/types/course.types";
import type { TourItem } from "@/lib/tour/types";
import type { PlaceAvailability } from "@/lib/pipeline";
import { withTimeout } from "@/shared/utils/withTimeout";
import { COURSE_ACTION_TIMEOUT_MS } from "@/shared/constants/courseAction";

const GENERIC_COURSE_ERROR = "갈 곳을 찾는 중 문제가 생겼어요. 다시 시도해주세요.";

type CourseGenerationResult =
  | {
      ok: true;
      courseId: string;
      place: JourneyPlace;
      courseName: string;
      festivals: FestivalSummary[];
      availability: PlaceAvailability;
    }
  | { ok: false; code: string };

// 장소/축제 카드 탭 → 시트 없이 바로 코스 생성 후 프리뷰로 이동하는 흐름을 캡슐화한다.
// 실패 메시지는 호출부(onError)로 넘겨 토스트 등 알림 UI는 화면이 계속 소유하게 한다.
export function useStartCourse(onError: (message: string) => void) {
  const router = useRouter();
  const [startingId, setStartingId] = useState<string | null>(null);

  // 이전 코스에서 쌓인 리롤 소진/거절 이력은 여기서 끊는다(리롤 자체는 이 경로를
  // 타지 않으므로 rejectedPlaceIds가 유지된다).
  const startPendingCourse = (
    result: Extract<CourseGenerationResult, { ok: true }>,
    lat: number,
    lng: number,
  ) => {
    useCourseProgressStore.getState().resetRerolls();

    const pending: PendingCourse = {
      courseId: result.courseId,
      place: result.place,
      courseName: result.courseName,
      festivals: result.festivals,
      mapX: lng,
      mapY: lat,
      availability: result.availability,
      generatedAt: Date.now(),
    };
    localStorage.setItem("pendingCourse", JSON.stringify(pending));
    router.push("/course/preview");
  };

  const run = async (
    id: string,
    lat: number,
    lng: number,
    generate: () => Promise<CourseGenerationResult>,
    errorMessage: (code: string) => string,
  ) => {
    if (startingId) return;
    setStartingId(id);

    // 세션 무효화 등 예상 밖의 예외(네트워크 단절 포함)로 await가 reject되면 아래 로직이
    // 전혀 실행되지 않고 setStartingId(null)도 못 돌아, 위쪽의 `if (startingId) return`
    // 가드 때문에 이후 어떤 카드를 눌러도 무반응 상태에 영구히 갇힌다 — 반드시 감싼다.
    // withTimeout: 서버 액션 자체는 reject조차 안 되고 영원히 pending일 수 있어(진짜
    // 네트워크 hang — withTimeout.ts 참고) try/catch만으론 부족하다.
    try {
      const result = await withTimeout(generate(), COURSE_ACTION_TIMEOUT_MS);
      if (!result.ok) {
        setStartingId(null);
        onError(errorMessage(result.code));
        return;
      }

      startPendingCourse(result, lat, lng);
    } catch (err) {
      console.error("[start] 코스 생성 실패:", err);
      setStartingId(null);
      onError(GENERIC_COURSE_ERROR);
    }
  };

  const selectPlace = (place: TourItem) => {
    const lat = parseFloat(place.mapy);
    const lng = parseFloat(place.mapx);

    run(
      place.contentid,
      lat,
      lng,
      () =>
        generateCourseFromPlaceAction({
          contentId: place.contentid,
          contentTypeId: place.contenttypeid,
          lat,
          lng,
        }),
      (code) =>
        code === "NOT_FOUND"
          ? "장소 정보를 찾을 수 없어요. 다른 장소를 선택해주세요."
          : GENERIC_COURSE_ERROR,
    );
  };

  const selectFestival = (festival: FestivalSummary) => {
    run(
      festival.id,
      festival.lat,
      festival.lng,
      () => generateCourseFromFestivalAction(festival),
      () => GENERIC_COURSE_ERROR,
    );
  };

  return { startingId, selectPlace, selectFestival };
}
