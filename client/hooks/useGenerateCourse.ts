"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocationStore } from "@/client/stores/useLocationStore";
import { useCourseProgressStore } from "@/client/stores/useCourseProgressStore";
import { generateCourseAction } from "@/app/actions/course";
import { saveCourseCompletionAction } from "@/app/actions/completion";
import { redirectToSignIn } from "@/client/redirectToSignIn";
import { buildCompletionPayload } from "@/shared/utils/completionPayload";
import type { PendingCourse } from "@/shared/types/course.types";
import type { Prefs } from "@/shared/constants/preferences";

// 시작했지만 완료하지 않은 이전 코스가 새 코스로 대체될 때 abandoned로 기록한다.
// 조건: 진행 스토어의 courseId가 덮어써질 pendingCourse와 일치할 때만 — 중복 기록 방지.
function recordAbandonedIfAny() {
  try {
    const raw = localStorage.getItem("pendingCourse");
    if (!raw) return;
    const prev = JSON.parse(raw) as Partial<PendingCourse>;
    const { courseId, startedAt, completedAt } =
      useCourseProgressStore.getState();
    if (!startedAt || completedAt || !courseId || courseId !== prev.courseId)
      return;
    const payload = buildCompletionPayload({
      pending: prev,
      status: "abandoned",
      startedAt,
      completedAt: null,
    });
    if (payload) void saveCourseCompletionAction(payload).catch(() => {});
  } catch {
    // 텔레메트리 — 실패해도 코스 생성 흐름은 그대로 진행
  }
}

// 위치 확인 → 코스 생성 서버 액션 호출 → localStorage 기록 → 프리뷰로 이동까지의 흐름을
// 캡슐화한다(useStartCourse.ts와 같은 결). 실패(NO_PLACE)면 noNearby 상태로 알려
// 화면(StartView)이 대안 UI(NoNearbyView)를 그리게 한다.
export function useGenerateCourse(prefs: Prefs) {
  const router = useRouter();
  const { state } = useLocationStore();
  const [loading, setLoading] = useState(false);
  const [noNearby, setNoNearby] = useState(false);
  // 마지막 생성 시도에 실제 사용된 검색 반경(m) — NoNearbyView 문구·확장 반경 계산용
  const [searchRadiusM, setSearchRadiusM] = useState<number | null>(null);

  const generate = async (
    scale: "light" | "moderate" | "leisurely",
    radiusM?: number,
  ) => {
    if (state.status !== "granted" || !state.lat || !state.lng) {
      console.warn("[StartView] coords 없음 — 코스 생성 중단");
      return;
    }
    const coords = { lat: state.lat, lng: state.lng };

    setLoading(true);

    // 세션 무효화 등 예상 밖의 예외(네트워크 단절 포함)로 await가 reject되면 아래 로직이
    // 전혀 실행되지 않고 setLoading(false)도 못 돌아 무한 로딩에 빠진다 — 반드시 감싼다.
    try {
      const result = await generateCourseAction({
        mapX: coords.lng,
        mapY: coords.lat,
        scale,
        prefs,
        radiusM,
      });

      if (!result.ok) {
        if (result.code === "UNAUTHENTICATED") {
          // 하드 네비게이션이 곧바로 일어나므로 로딩 상태를 따로 풀 필요는 없다.
          redirectToSignIn(result.reason === "invalid_session" ? "session_expired" : undefined);
          return;
        }
        setLoading(false);
        if (result.code === "NO_PLACE") {
          setSearchRadiusM(result.radiusM);
          setNoNearby(true);
        }
        return;
      }

      console.log(`[festival] 클라이언트 수신 — ${result.festivals.length}건`, result.festivals);

      // 암묵 abandoned — 시작했지만 완료하지 않은 이전 코스가 새 코스로 대체되는 순간,
      // 포기가 확정된다. 새 인터랙션 없이 이 시점에 기록만 남긴다(완료율 관측용).
      recordAbandonedIfAny();

      // 새 코스 생성 — 이전 코스에서 쌓인 리롤 소진/거절 이력은 여기서 끊는다.
      // 리롤(같은 코스 내 재추천)에서는 이 경로를 타지 않으므로 rejectedPlaceIds가 유지된다.
      useCourseProgressStore.getState().resetRerolls();

      const pending: PendingCourse = {
        courseId: result.courseId,
        place: result.place,
        courseName: result.courseName,
        festivals: result.festivals,
        mapX: coords.lng,
        mapY: coords.lat,
        scale,
        // 생성 시점 취향 스냅샷 — 결과 화면의 칩·맛집 섹션·재추천이 이 값을 읽는다
        prefs,
        generatedAt: Date.now(),
      };
      localStorage.setItem("pendingCourse", JSON.stringify(pending));
      router.push("/course/preview");
    } catch (err) {
      console.error("[start] 코스 생성 실패:", err);
      setLoading(false);
    }
  };

  return {
    loading,
    noNearby,
    setNoNearby,
    searchRadiusM,
    generate,
  };
}
