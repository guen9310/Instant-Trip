"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCourseProgressStore } from "@/client/stores/useCourseProgressStore";
import { fetchNearbyPoisAction } from "@/app/actions/course";
import type { JourneyPlace, NearbyCategory, NearbyPoi, PendingCourse } from "@/shared/types/course.types";

function readSessionPlace(): JourneyPlace | null {
  try {
    const raw = localStorage.getItem("pendingCourse");
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<PendingCourse>;
    return data.place ?? null;
  } catch {
    return null;
  }
}

type CourseActiveState =
  | { status: "loading" }
  | { status: "ready"; place: JourneyPlace; cat: NearbyCategory; setCat: (cat: NearbyCategory) => void; pois: NearbyPoi[]; poisLoading: boolean; filteredPois: NearbyPoi[]; selectedPoiId: string | null; selectPoi: (id: string | null) => void; handleComplete: () => void };

export function useCourseActive(courseId: string): CourseActiveState {
  const router = useRouter();
  const start = useCourseProgressStore((s) => s.start);

  const [place, setPlace] = useState<JourneyPlace | null | "loading">("loading");
  const [cat, setCat] = useState<NearbyCategory>("all");
  const [pois, setPois] = useState<NearbyPoi[]>([]);
  const [fetchedKey, setFetchedKey] = useState<string | null>(null);
  const [selectedPoiId, selectPoi] = useState<string | null>(null);

  useEffect(() => {
    const loaded = readSessionPlace();
    setPlace(loaded);
    if (loaded) start(courseId);
  }, [courseId, start]);

  useEffect(() => {
    if (place === null) router.push("/start");
  }, [place, router]);

  const current = place !== "loading" && place !== null ? place : undefined;

  // 좌표를 문자열 키로 변환해 객체 참조 문제 없이 의존성 비교
  const coordKey = current?.coord ? `${current.coord.lat},${current.coord.lng}` : null;

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
    router.push(`/course/${courseId}/done`);
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
