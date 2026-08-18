"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

// 데모/QA 전용 — /start?debugWeather=rain 같은 쿼리 파라미터로 날씨 게이트를 강제
// 트리거한다. 서버(app/actions/course.ts)가 WEATHER_GATE_DEBUG_ENABLED 환경변수가
// 켜져 있을 때만 실제로 반영하므로, 여기서 유효하지 않은 값을 걸러내는 정도로 충분하다.
const DEBUG_WEATHER_VALUES = ["clear", "cloudy", "rain", "snow", "heatwave"] as const;
type DebugWeather = (typeof DEBUG_WEATHER_VALUES)[number];

function readDebugWeather(searchParams: URLSearchParams): DebugWeather | undefined {
  const raw = searchParams.get("debugWeather");
  return (DEBUG_WEATHER_VALUES as readonly string[]).includes(raw ?? "")
    ? (raw as DebugWeather)
    : undefined;
}

// 위치 확인 → 코스 생성 서버 액션 호출 → localStorage 기록 → 프리뷰로 이동까지의 흐름을
// 캡슐화한다(useStartCourse.ts와 같은 결). 실패(NO_PLACE)면 noNearby 상태로 알려
// 화면(StartView)이 대안 UI(NoNearbyView)를 그리게 한다.
export function useGenerateCourse(prefs: Prefs) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
      // "이런 곳은 싫어요"로 거절했던 장소는 /start를 거쳐 새로 생성해도 다시 뜨면
      // 안 된다 — 누적된 거절 이력을 그대로 excludeIds로 넘긴다.
      const { rejectedPlaceIds } = useCourseProgressStore.getState();
      const result = await generateCourseAction({
        mapX: coords.lng,
        mapY: coords.lat,
        scale,
        prefs,
        radiusM,
        excludeIds: rejectedPlaceIds,
        debugWeather: readDebugWeather(searchParams),
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

      // 방금 받은 추천에는 위에서 넘긴 excludeIds가 이미 반영돼 있어 직전 거절 장소가
      // 다시 나올 일은 없다 — 그러니 여기서 거절 이력을 지워도 "거절한 곳이 재추천됨"
      // 버그는 재발하지 않는다. 반대로 지우지 않으면 /start를 오갈 때마다 거절 이력이
      // 끝없이 쌓여, 후보가 적은 지역에서는 이번 라운드 첫 거절만으로 근처 후보가
      // 고갈된 것처럼 보일 수 있다(리롤 소진 카운트는 새로 채워지는데 실제 제외
      // 목록은 계속 불어나는 불일치). /start 왕복 자체가 "새 탐색"으로 간주할 만한
      // 마찰(재조건 설정)이 있으므로, 여기서 거절 이력까지 함께 새로 시작한다.
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
        weatherSwitch: result.weatherSwitch,
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
