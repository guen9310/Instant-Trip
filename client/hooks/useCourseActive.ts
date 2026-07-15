"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClientRead, HYDRATING } from "@/client/hooks/useClientRead";
import { useCourseProgressStore } from "@/client/stores/useCourseProgressStore";
import { fetchNearbyPoisAction } from "@/app/actions/course";
import { haversineM } from "@/shared/utils/geo";
import type { JourneyPlace, NearbyCategory, NearbyPoi, PendingCourse } from "@/shared/types/course.types";

// 위치 도장 최소 간격(ms) — 같은 체류 안에서 과도한 중복 기록 방지
const STAMP_MIN_INTERVAL_MS = 60_000;

// 위치 도장 1샷 — 기존 이벤트(화면 진입/재개, 완료 버튼)에 편승해 장소와의 거리를 기록한다.
// 측정 전용 UI 없음: 팝업·대기 없이 조용히 시도하고, 실패하면 아무 일도 없다.
// 저장하는 값은 좌표 원본이 아니라 장소와의 거리(m) 하나다.
function captureStamp(
  placeCoord: { lat: number; lng: number } | null,
  opts?: { force?: boolean },
) {
  if (!placeCoord || typeof navigator === "undefined" || !navigator.geolocation) return;
  const { stamps } = useCourseProgressStore.getState();
  const last = stamps[stamps.length - 1];
  if (!opts?.force && last && Date.now() - last.t < STAMP_MIN_INTERVAL_MS) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const distM = haversineM(
        pos.coords.latitude,
        pos.coords.longitude,
        placeCoord.lat,
        placeCoord.lng,
      );
      useCourseProgressStore.getState().addStamp({ t: Date.now(), distM });
    },
    () => {}, // 권한 없음/타임아웃 — 조용히 무시
    { timeout: 3000, maximumAge: 60_000, enableHighAccuracy: false },
  );
}

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
      cat: NearbyCategory;
      setCat: (cat: NearbyCategory) => void;
      pois: NearbyPoi[];
      poisLoading: boolean;
      filteredPois: NearbyPoi[];
      selectedPoiId: string | null;
      selectPoi: (id: string | null) => void;
      handleComplete: () => void;
    };

export function useCourseActive(courseId: string): CourseActiveState {
  const router = useRouter();
  const complete = useCourseProgressStore((s) => s.complete);

  const session = useClientRead(readSession);
  const [cat, setCat] = useState<NearbyCategory>("all");
  const [pois, setPois] = useState<NearbyPoi[]>([]);
  const [fetchedKey, setFetchedKey] = useState<string | null>(null);
  const [selectedPoiId, selectPoi] = useState<string | null>(null);

  // 세션 읽기 결과에서 직접 도출 — 효과로 상태에 복제하지 않는다
  const current = session === HYDRATING ? undefined : session?.place;
  const searchCoord = session === HYDRATING ? null : (session?.searchCoord ?? null);

  useEffect(() => {
    if (session === null) router.push("/start");
  }, [session, router]);

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

  // 위치 도장: 진행 화면 진입 시 1회 + 화면 재개(백그라운드→포그라운드)마다 1회.
  // "장소에서 처음/마지막으로 목격된 시각"이 체류시간 실측의 근거가 된다.
  const placeCoord = current?.coord ?? null;
  const placeCoordKey = placeCoord ? `${placeCoord.lat},${placeCoord.lng}` : null;
  useEffect(() => {
    if (!placeCoordKey) return;
    const [lat, lng] = placeCoordKey.split(",").map(Number);
    const coord = { lat, lng };
    captureStamp(coord);
    const onVisible = () => {
      if (document.visibilityState === "visible") captureStamp(coord);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [placeCoordKey]);

  if (!current) {
    return { status: "loading" };
  }

  const filteredPois = cat === "all" ? pois : pois.filter((p) => p.category === cat);

  const handleComplete = () => {
    // 완료 순간 도장 — "장소 안에서 눌렀는가"가 기록의 신뢰 라벨이 된다.
    // 가장 가치 있는 도장이므로 스로틀을 무시하고 항상 시도한다.
    // 응답을 기다리지 않고 즉시 이동; 콜백은 done 화면에서 저장되기 전에 도착한다.
    captureStamp(placeCoord, { force: true });
    complete();
    router.push(`/course/done/${courseId}`);
  };

  return {
    status: "ready",
    place: current,
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
