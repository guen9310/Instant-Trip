"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCourseProgressStore } from "@/client/stores/useCourseProgressStore";
import { fetchNearbyPoisAction } from "@/app/actions/course";
import type { JourneyPlace, NearbyCategory, NearbyPoi } from "@/shared/types/course.types";

function readSessionCourse(): JourneyPlace[] | null {
  try {
    const raw = sessionStorage.getItem("pendingCourse");
    if (!raw) return null;
    const data = JSON.parse(raw) as { places?: JourneyPlace[] };
    return Array.isArray(data.places) && data.places.length > 0 ? data.places : null;
  } catch {
    return null;
  }
}

type CourseActiveState =
  | { status: "loading" }
  | { status: "ready"; places: JourneyPlace[]; idx: number; current: JourneyPlace; next: JourneyPlace | undefined; cat: NearbyCategory; setCat: (cat: NearbyCategory) => void; pois: NearbyPoi[]; poisLoading: boolean; filteredPois: NearbyPoi[]; selectedPoiId: string | null; selectPoi: (id: string | null) => void; handleAdvance: () => void };

export function useCourseActive(): CourseActiveState {
  const router = useRouter();
  const { courseId, currentIdx, start, advance } = useCourseProgressStore();

  const [places, setPlaces] = useState<JourneyPlace[] | null | "loading">("loading");
  const [cat, setCat] = useState<NearbyCategory>("all");
  const [pois, setPois] = useState<NearbyPoi[]>([]);
  const [fetchedKey, setFetchedKey] = useState<string | null>(null);
  const [selectedPoiId, selectPoi] = useState<string | null>(null);

  useEffect(() => {
    const loaded = readSessionCourse();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaces(loaded);
    if (loaded) start("current", loaded.length);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (places === null) router.push("/start");
  }, [places, router]);

  const idx = places && places !== "loading" && courseId ? currentIdx : 0;
  const current = places && places !== "loading" ? places[idx] : undefined;

  // 좌표를 문자열 키로 변환해 객체 참조 문제 없이 의존성 비교
  const coordKey = current?.coord ? `${current.coord.lat},${current.coord.lng}` : null;

  // 파생 상태 — 키가 있는데 아직 해당 키로 fetch하지 않은 경우 = 로딩 중
  const poisLoading = coordKey !== null && coordKey !== fetchedKey;

  useEffect(() => {
    if (!coordKey) return;
    const [lat, lng] = coordKey.split(",").map(Number);
    fetchNearbyPoisAction(lat, lng).then((result) => {
      console.log("[pois] action result:", result);
      if (result.ok) {
        console.log("[pois] setState:", result.pois.map((p) => `${p.category}:${p.name}`));
        setPois(result.pois);
      }
      setFetchedKey(coordKey);
    });
  }, [coordKey]);

  if (places === "loading" || places === null || !current) {
    return { status: "loading" };
  }

  const next = places[idx + 1];
  const filteredPois = cat === "all" ? pois : pois.filter((p) => p.category === cat);
  console.log(`[pois] render — cat="${cat}" pois=${pois.length}건 filteredPois=${filteredPois.length}건`, filteredPois.map((p) => p.name));

  const handleAdvance = () => {
    if (idx >= places.length - 1) {
      router.push(`/course/${courseId ?? "1"}/done`);
    } else {
      advance();
    }
  };

  return {
    status: "ready",
    places,
    idx,
    current,
    next,
    cat,
    setCat,
    pois,
    poisLoading,
    filteredPois,
    selectedPoiId,
    selectPoi,
    handleAdvance,
  };
}
