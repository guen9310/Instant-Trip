"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClientRead, HYDRATING } from "@/client/hooks/useClientRead";
import { useCourseProgressStore } from "@/client/stores/useCourseProgressStore";
import { fetchNearbyPoisAction } from "@/app/actions/course";
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
  }, [session, dbFallback, router]);

  // 좌표를 문자열 키로 변환해 객체 참조 문제 없이 의존성 비교
  const coordKey = searchCoord ? `${searchCoord.lat},${searchCoord.lng}` : null;

  // 파생 상태 — 키가 있는데 아직 해당 키로 fetch하지 않은 경우 = 로딩 중
  const poisLoading = coordKey !== null && coordKey !== fetchedKey;

  useEffect(() => {
    if (!coordKey) return;
    const [lat, lng] = coordKey.split(",").map(Number);
    fetchNearbyPoisAction(lat, lng).then((result) => {
      if (result.ok) {
        setPois(result.pois);
      }
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
