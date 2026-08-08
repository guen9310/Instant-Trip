"use client";

import { useState } from "react";
import { useCourseProgressStore, MAX_REROLLS } from "@/client/stores/useCourseProgressStore";
import { generateCourseAction } from "@/app/actions/course";
import { haversineKm } from "@/shared/utils/geo";
import type { JourneyPlace, PendingCourse } from "@/shared/types/course.types";
import type { Prefs } from "@/shared/constants/preferences";

// 운영시간 배지 스냅샷 유효 시간 — 이보다 오래된 generatedAt은 배지를 숨긴다.
// 판정 자체는 코스 생성 시점의 실시간 계산이라 그 이후 시간이 흐르면 더 이상 유효하지 않다.
const BADGE_SNAPSHOT_MAX_AGE_MS = 30 * 60 * 1000;

// "재추천 사유 설명 칩" — 거절 사유가 이번 리롤에 실제로 반영됐음을 사용자에게
// 보여준다. 텍스트는 CourseResultView가 REASON_CHIP_COPY로 매핑해 아이콘과 함께
// 렌더한다(관심사 분리 — 이 훅은 "그 사유가 실제로 해소됐는지"만 판단한다).
export type ReasonChipKind = "far" | "time" | "visited";

// satisfied: false는 "far" 전용 — maxDistanceKm은 하드 보장이 아니라 우선순위라
// lib/pipeline/index.ts가 조용히 폴백할 수 있다(더 가까운 곳이 없어서 원래 후보로
// 되돌아감). 그 폴백을 사용자에게도 정직하게 알려주려고 satisfied:false 상태를 둔다.
// "time"은 만족 못 하면 아예 칩을 안 띄운다(상단 운영시간 배지가 이미 그 정보를
// 담당해 중복이라 판단) — 그래서 이 타입엔 있어도 실제로 false가 나오는 건 "far"뿐.
// "visited"는 excludeIds가 세션 내 재노출을 항상 하드 차단해 폴백 자체가 없다.
export type ReasonChipState = { kind: ReasonChipKind; satisfied: boolean } | null;

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
  // 리롤이 방금 어떤 거절 사유를 실제로 해소했는지 — CourseResultView가 이 값으로
  // 사유 칩의 문구·아이콘을 고른다. 최초 진입(마운트)에는 항상 null(리롤 자체가
  // 없었으므로).
  const [reasonChip, setReasonChip] = useState<ReasonChipState>(null);

  const { rejectedPlaceIds, rerollCount, addRejection } = useCourseProgressStore();
  const isMaxRerolls = rerollCount >= MAX_REROLLS;

  const doReroll = async (
    excludeIds: string[],
    opts: {
      maxDistanceKm?: number;
      strictOpenOnly?: boolean;
      reasonForChip?: ReasonChipKind;
    } = {},
  ) => {
    // prefs 없음 = 구버전 localStorage 페이로드 — 생성 시점 취향을 모르니 재추천 불가
    if (!mapX || !mapY || !scale || !prefs) return;
    setRerolling(true);
    setRerollExhausted(false);
    setReasonChip(null);

    const prevId = currentPlace.id;
    const prevCoord = currentPlace.coord;

    const result = await generateCourseAction({
      mapX,
      mapY,
      scale: scale as "light" | "moderate" | "leisurely",
      prefs,
      excludeIds,
      maxDistanceKm: opts.maxDistanceKm,
      strictOpenOnly: opts.strictOpenOnly,
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

    // 사유 칩 — 주장한 게 실제로 참인지 직접 검증한다. maxDistanceKm/strictOpenOnly는
    // 우선순위일 뿐 하드 보장이 아니라서(lib/pipeline/index.ts의 폴백 참조), 검증 없이
    // 무조건 성공 문구를 띄우면 폴백된 경우에도 "더 가까워요"라고 거짓 주장하게 된다.
    if (opts.reasonForChip === "far") {
      const satisfied = Boolean(
        prevCoord &&
          result.place.coord &&
          haversineKm(mapY, mapX, result.place.coord.lat, result.place.coord.lng) <
            haversineKm(mapY, mapX, prevCoord.lat, prevCoord.lng),
      );
      // far는 만족 못 해도(폴백) "더 가까운 곳이 없었다"는 사실 자체를 알려줄 가치가
      // 있다 — 다른 어떤 UI도 이 정보를 안 알려주기 때문. satisfied:false로 켠다.
      setReasonChip({ kind: "far", satisfied });
    } else if (opts.reasonForChip === "time") {
      // 만족 못 하면 칩 자체를 안 켠다 — 상단 운영시간 배지("확인 필요")가 이미
      // 같은 정보를 담당해서 중복 안내가 된다.
      if (result.place.availabilityUncertain === false) {
        setReasonChip({ kind: "time", satisfied: true });
      }
    } else if (opts.reasonForChip === "visited") {
      // excludeIds가 세션 내 재노출을 항상 하드 차단하므로 별도 검증 없이도 항상 참.
      setReasonChip({ kind: "visited", satisfied: true });
    }

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

    // 거절 사유가 다음 리롤에 실제로 반영되도록 사유별 파라미터를 계산한다.
    // "취향이 아니에요"는 아직 미구현 — 별도 파라미터·사유 칩 없이 기존과 동일하게
    // 동작한다(rejectedPlaceIds 제외만 적용).
    const opts: {
      maxDistanceKm?: number;
      strictOpenOnly?: boolean;
      reasonForChip?: ReasonChipKind;
    } = {};
    if (rejectReason === "far" && currentPlace.coord && mapY != null && mapX != null) {
      opts.maxDistanceKm = haversineKm(
        mapY,
        mapX,
        currentPlace.coord.lat,
        currentPlace.coord.lng,
      );
      opts.reasonForChip = "far";
    }
    if (rejectReason === "time") {
      opts.strictOpenOnly = true;
      opts.reasonForChip = "time";
    }
    if (rejectReason === "visited") {
      opts.reasonForChip = "visited";
    }

    await doReroll([...rejectedPlaceIds, currentPlace.id], opts);
    closeRejectPanel();
  };

  return {
    currentCourseId,
    currentPlace,
    currentCourseName,
    isBadgeSnapshotStale,
    rerollExhausted,
    reasonChip,
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
