"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClientRead, HYDRATING } from "@/client/hooks/useClientRead";
import { useCourseProgressStore } from "@/client/stores/useCourseProgressStore";
import { saveCourseCompletionAction } from "@/app/actions/completion";
import { buildCompletionPayload } from "@/shared/utils/completionPayload";
import { MOCK_PLACES } from "@/shared/constants/courseMock";
import type { PendingCourse } from "@/shared/types/course.types";

function readPendingCourse(): Partial<PendingCourse> | null {
  try {
    const raw = localStorage.getItem("pendingCourse");
    if (!raw) return null;
    return JSON.parse(raw) as Partial<PendingCourse>;
  } catch {
    return null;
  }
}

// 코스 완료 화면 — 저장된 pendingCourse 읽기, 별점·반응 태그 상태, 완료 기록 저장
// 서버 액션 호출과 리셋·홈 이동까지 한데 묶는다.
export function useCourseDone() {
  const router = useRouter();
  const { startedAt, completedAt, reset } = useCourseProgressStore();
  const [stars, setStars] = useState(0);
  const [reactions, setReactions] = useState<string[]>([]);

  // 저장소 읽기 결과에서 직접 도출 — 하이드레이션 중엔 null(기존 초기 상태와 동일 렌더)
  const pending = useClientRead(readPendingCourse);
  const place = pending === HYDRATING ? null : (pending?.place ?? MOCK_PLACES[0]);

  const toggleReaction = (tag: string) => {
    setReactions((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleDone = () => {
    // 완료 기록 저장 — reset()이 타임스탬프를 지우므로 그 전에 페이로드를 만든다.
    // 실제 pendingCourse가 있을 때만 저장(MOCK fallback 데이터는 기록하지 않음).
    const payload = buildCompletionPayload({
      pending: readPendingCourse(),
      status: "completed",
      startedAt,
      completedAt,
      rating: stars > 0 ? stars : null,
      reactions,
    });
    if (payload) {
      // 텔레메트리 — 실패해도 완료 흐름은 그대로 진행
      void saveCourseCompletionAction(payload).catch(() => {});
    }
    reset();
    localStorage.removeItem("pendingCourse");
    router.push("/");
  };

  return { place, stars, setStars, reactions, toggleReaction, handleDone };
}
