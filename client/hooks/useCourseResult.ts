"use client";

import { useState } from "react";
import { useCourseProgressStore, MAX_REROLLS } from "@/client/stores/useCourseProgressStore";
import { generateCourseAction } from "@/app/actions/course";
import type { JourneyPlace, PendingCourse } from "@/shared/types/course.types";
import type { Prefs } from "@/shared/constants/preferences";

// 운영시간 배지 스냅샷 유효 시간 — 이보다 오래된 generatedAt은 배지를 숨긴다.
// 판정 자체는 코스 생성 시점의 실시간 계산이라 그 이후 시간이 흐르면 더 이상 유효하지 않다.
const BADGE_SNAPSHOT_MAX_AGE_MS = 30 * 60 * 1000;

type Params = {
  courseId: string;
  courseName: string;
  place: JourneyPlace;
  generatedAt?: number;
  mapX?: number;
  mapY?: number;
  scale?: string;
  prefs?: Prefs;
};

// 코스 프리뷰의 재추천(리롤)·거절 흐름 — 현재 장소·운영시간 배지 신선도·거절 패널
// 상태와 서버 액션 호출을 한데 묶는다. CourseResultView는 이 결과를 렌더만 한다.
export function useCourseResult({
  courseId,
  courseName,
  place,
  generatedAt,
  mapX,
  mapY,
  scale,
  prefs,
}: Params) {
  const [rerolling, setRerolling] = useState(false);
  const [currentCourseId, setCurrentCourseId] = useState(courseId);
  const [currentPlace, setCurrentPlace] = useState<JourneyPlace>(place);
  const [currentCourseName, setCurrentCourseName] = useState(courseName);
  const [currentGeneratedAt, setCurrentGeneratedAt] = useState(generatedAt);
  // 최초 진입 시점(마운트) 기준 1회만 판단한다 — 리롤 시엔 doReroll이 방금 생성된
  // 신선한 스냅샷임을 알고 있으므로 같은 핸들러에서 false로 직접 갱신한다
  // (effect로 다른 state 변화에 반응해 setState하는 캐스케이드 패턴을 피한다).
  const [isBadgeSnapshotStale, setIsBadgeSnapshotStale] = useState(
    () =>
      !currentGeneratedAt ||
      Date.now() - currentGeneratedAt > BADGE_SNAPSHOT_MAX_AGE_MS,
  );
  const [rerollExhausted, setRerollExhausted] = useState(false);
  const [newPlaceId, setNewPlaceId] = useState<string | null>(null);
  const [rejectPanelOpen, setRejectPanelOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState<string | null>(null);

  const { rejectedPlaceIds, rerollCount, addRejection } = useCourseProgressStore();
  const isMaxRerolls = rerollCount >= MAX_REROLLS;

  const doReroll = async (excludeIds: string[]) => {
    // prefs 없음 = 구버전 localStorage 페이로드 — 생성 시점 취향을 모르니 재추천 불가
    if (!mapX || !mapY || !scale || !prefs) return;
    setRerolling(true);
    setRerollExhausted(false);

    const prevId = currentPlace.id;

    const result = await generateCourseAction({
      mapX,
      mapY,
      scale: scale as "light" | "moderate" | "leisurely",
      prefs,
      excludeIds,
    });

    setRerolling(false);

    if (!result.ok) {
      setRerollExhausted(true);
      return;
    }

    setCurrentCourseId(result.courseId);
    setCurrentPlace(result.place);
    setCurrentCourseName(result.courseName);
    console.log(
      `[festival] 재추천 후 수신 — ${result.festivals.length}건`,
      result.festivals,
    );

    if (result.place.id !== prevId) {
      setNewPlaceId(result.place.id);
      setTimeout(() => setNewPlaceId(null), 3000);
    }

    const nextGeneratedAt = Date.now();
    setCurrentGeneratedAt(nextGeneratedAt);
    setIsBadgeSnapshotStale(false); // 방금 생성한 신선한 스냅샷

    const pending: PendingCourse = {
      courseId: result.courseId,
      place: result.place,
      courseName: result.courseName,
      festivals: result.festivals,
      mapX,
      mapY,
      scale,
      prefs,
      generatedAt: nextGeneratedAt,
    };
    localStorage.setItem("pendingCourse", JSON.stringify(pending));
  };

  const openRejectPanel = () => setRejectPanelOpen(true);

  const closeRejectPanel = () => {
    setRejectPanelOpen(false);
    setRejectReason(null);
  };

  // 거절 이유 확정 — 원래 PlaceDetailSheet(드로어)의 "여기 말고 다른 곳으로"와 동일하게,
  // 리롤 성공/실패 여부와 무관하게 완료 후 패널을 닫는다(실패 시엔 rerollExhausted 배너가 안내).
  const confirmReject = async () => {
    if (!rejectReason) return;
    console.log(
      `[reroll] 거절 — placeId: ${currentPlace.id}, reason: ${rejectReason}`,
    );
    addRejection(currentPlace.id);
    await doReroll([...rejectedPlaceIds, currentPlace.id]);
    closeRejectPanel();
  };

  return {
    currentCourseId,
    currentPlace,
    currentCourseName,
    isBadgeSnapshotStale,
    rerollExhausted,
    newPlaceId,
    rerolling,
    isMaxRerolls,
    rejectPanelOpen,
    openRejectPanel,
    closeRejectPanel,
    rejectReason,
    setRejectReason,
    confirmReject,
  };
}
