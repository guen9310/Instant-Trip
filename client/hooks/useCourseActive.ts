"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClientRead, HYDRATING } from "@/client/hooks/useClientRead";
import { useCourseProgressStore } from "@/client/stores/useCourseProgressStore";
import { fetchNearbyPoisAction } from "@/app/actions/course";
import { redirectToSignIn } from "@/client/redirectToSignIn";
import { withTimeout } from "@/shared/utils/withTimeout";
import { COURSE_ACTION_TIMEOUT_MS } from "@/shared/constants/courseAction";
import type {
  JourneyPlace,
  NearbyCategory,
  NearbyPoi,
  PendingCourse,
  ResumableCourse,
} from "@/shared/types/course.types";

type SessionData = {
  place: JourneyPlace;
  // place.coord가 null일 때 fallback — PendingCourse에 저장된 유저 GPS 좌표
  // PendingCourse.mapX = 경도, mapY = 위도 (카카오 좌표계)
  searchCoord: { lat: number; lng: number } | null;
};

function readSession(): SessionData | null {
  try {
    const raw = localStorage.getItem("pendingCourse");
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<PendingCourse>;
    if (!data.place) return null;
    const place: JourneyPlace = { ...data.place, tags: data.place.tags ?? [] };
    const searchCoord =
      place.coord ??
      (data.mapX != null && data.mapY != null ? { lat: data.mapY, lng: data.mapX } : null);
    return { place, searchCoord };
  } catch {
    return null;
  }
}

type CourseActiveState =
  | { status: "loading" }
  | {
      status: "ready";
      place: JourneyPlace;
      // 지도 마커용 좌표 — place.coord가 없는 구버전 페이로드는 검색 원점으로 대체(placeCoord 패턴,
      // CourseResultView와 동일). 둘 다 없으면 null → 호출부에서 지도 자체를 숨긴다.
      placeCoord: { lat: number; lng: number } | null;
      cat: NearbyCategory;
      setCat: (cat: NearbyCategory) => void;
      pois: NearbyPoi[];
      poisLoading: boolean;
      filteredPois: NearbyPoi[];
      selectedPoiId: string | null;
      selectPoi: (id: string | null) => void;
      handleComplete: () => void;
    };

export function useCourseActive(
  courseId: string,
  // localStorage의 pendingCourse가 없을 때(다른 기기·저장소 초기화, 혹은 프로필의
  // "이어서"가 클라이언트 courseId가 아닌 DB courses.id를 가리켜 애초에 로컬에 매칭되는
  // 세션이 없는 경우) 화면을 복원할 서버 측 대비책. page.tsx가 미리 조회해 내려준다.
  dbFallback: ResumableCourse | null,
  // page.tsx가 getAuthState()로 미리 판정 — 세션이 서버에서 무효화된 경우에만 true.
  // dbFallback이 없을 때(로컬도 DB도 복원 못함) 이 값에 따라 /start로 조용히 보낼지,
  // 로그인 화면의 만료 배너로 보낼지를 가른다.
  sessionExpired: boolean,
): CourseActiveState {
  const router = useRouter();
  const complete = useCourseProgressStore((s) => s.complete);

  const session = useClientRead(readSession);
  const [cat, setCat] = useState<NearbyCategory>("all");
  const [pois, setPois] = useState<NearbyPoi[]>([]);
  const [fetchedKey, setFetchedKey] = useState<string | null>(null);
  const [selectedPoiId, selectPoi] = useState<string | null>(null);

  // 세션 읽기 결과에서 직접 도출 — 효과로 상태에 복제하지 않는다.
  // localStorage에 세션이 없으면(session === null) dbFallback으로 대체한다.
  const current =
    session === HYDRATING ? undefined : (session?.place ?? dbFallback?.place);
  const searchCoord = session === HYDRATING ? null : (session?.searchCoord ?? null);

  useEffect(() => {
    if (session !== null) return; // 로딩 중이거나 이미 유효한 로컬 세션이 있음

    if (!dbFallback) {
      // 세션이 서버에서 무효화된 경우엔 "저장된 코스가 없어요" 취급으로 조용히
      // /start로 보내지 않고, CourseResultView·SettingsView와 동일하게 로그인 화면의
      // 만료 배너로 보낸다 — redirectToSignIn은 하드 네비게이션이라 컴포넌트 언마운트
      // 여부와 무관하게 항상 배너가 뜬다.
      if (sessionExpired) {
        redirectToSignIn("session_expired");
        return;
      }
      router.push("/start");
      return;
    }

    // DB에서 복원한 세션을 localStorage에 반영 — 이후 "방문 완료"가 이 courseId로
    // saveCourseCompletionAction을 호출할 때 completionId/dbCourseId로 INSERT 대신
    // UPDATE 경로를 타게 하고, 새로고침 시에도 다시 이 fallback을 거치지 않게 한다.
    const pending: PendingCourse = {
      courseId: dbFallback.courseId,
      place: dbFallback.place,
      courseName: dbFallback.courseName,
      scale: dbFallback.scale,
      completionId: dbFallback.completionId,
      dbCourseId: dbFallback.courseId,
    };
    localStorage.setItem("pendingCourse", JSON.stringify(pending));
  }, [session, dbFallback, sessionExpired, router]);

  // 좌표를 문자열 키로 변환해 객체 참조 문제 없이 의존성 비교
  const coordKey = searchCoord ? `${searchCoord.lat},${searchCoord.lng}` : null;

  // 파생 상태 — 키가 있는데 아직 해당 키로 fetch하지 않은 경우 = 로딩 중
  const poisLoading = coordKey !== null && coordKey !== fetchedKey;

  useEffect(() => {
    if (!coordKey) return;
    const [lat, lng] = coordKey.split(",").map(Number);
    // withTimeout: 서버 액션 자체는 reject조차 안 되고 영원히 pending일 수 있어(진짜
    // 네트워크 hang — withTimeout.ts 참고) .catch()만으론 부족하다.
    withTimeout(fetchNearbyPoisAction(lat, lng), COURSE_ACTION_TIMEOUT_MS)
      .then((result) => {
        if (result.ok) {
          setPois(result.pois);
        }
        setFetchedKey(coordKey);
      })
      .catch((err) => {
        // reject(네트워크 단절 등)로 setFetchedKey를 못 부르면 poisLoading이
        // (coordKey !== fetchedKey) 영구히 true로 남아 주변 정보 섹션이 로딩
        // 상태에 고착된다 — 실패해도 반드시 fetchedKey는 갱신한다.
        console.error("[nearby] 주변 정보 조회 실패:", err);
        setFetchedKey(coordKey);
      });
  }, [coordKey]);

  if (!current) {
    return { status: "loading" };
  }

  const filteredPois = cat === "all" ? pois : pois.filter((p) => p.category === cat);

  const handleComplete = () => {
    complete();
    router.push(`/course/done/${courseId}`);
  };

  return {
    status: "ready",
    place: current,
    placeCoord: current.coord ?? searchCoord,
    cat,
    setCat,
    pois,
    poisLoading,
    filteredPois,
    selectedPoiId,
    selectPoi,
    handleComplete,
  };
}
