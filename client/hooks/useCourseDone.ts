"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClientRead, HYDRATING } from "@/client/hooks/useClientRead";
import { saveCourseCompletionAction } from "@/app/actions/completion";
import { redirectToSignIn } from "@/client/redirectToSignIn";
import { clearStartedCourse, readStartedCourse } from "@/client/startedCourseStorage";
import { buildCompletionPayload } from "@/shared/utils/completionPayload";
import { withTimeout } from "@/shared/utils/withTimeout";
import { COURSE_ACTION_TIMEOUT_MS } from "@/shared/constants/courseAction";

const SAVE_ERROR = "저장하지 못했어요. 다시 시도해주세요.";
const REVIEW_SAVE_ERROR = "후기를 저장하지 못했어요. 다시 시도하거나 그냥 넘길 수 있어요.";

// 코스 완료 화면 — URL의 코스와 일치하는 진행 중 코스 읽기, 별점·반응 태그 상태,
// 후기 저장 서버 액션 호출과 정리·홈 이동까지 한데 묶는다.
// 방문 완료 자체는 진행 화면에서 이미 저장됐다(completedAt) — 여기서는 후기만 덧붙인다.
export function useCourseDone(courseId: string) {
  const router = useRouter();
  const [stars, setStars] = useState(0);
  const [reactions, setReactions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 저장소 읽기 결과에서 직접 도출 — 하이드레이션 중엔 null(기존 초기 상태와 동일 렌더)
  const started = useClientRead(() => readStartedCourse(courseId));
  const place = started === HYDRATING ? null : (started?.place ?? null);

  // 이 코스의 진행 기록이 없으면(빈 저장소·다른 코스 URL) 보여줄 장소도, 덧붙일 기록도 없다 —
  // 임의의 장소를 띄우지 않고 홈으로 돌려보낸다.
  useEffect(() => {
    if (started === null) router.replace("/");
  }, [started, router]);

  const toggleReaction = (tag: string) => {
    setReactions((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  // 서버 저장이 확인된 뒤에만 로컬 기록을 지운다.
  const finish = () => {
    clearStartedCourse();
    router.push("/");
  };

  const save = async (rating: number | null, tags: string[]) => {
    if (saving || started === HYDRATING || !started) return;
    const latest = readStartedCourse(courseId) ?? started;
    const completedAt = latest.completedAt ?? Date.now();
    const payload = buildCompletionPayload({
      pending: latest,
      status: "completed",
      startedAt: latest.startedAt ?? null,
      completedAt,
      rating,
      reactions: tags,
    });
    if (!payload) {
      finish();
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const result = await withTimeout(saveCourseCompletionAction(payload), COURSE_ACTION_TIMEOUT_MS);
      if (!result.ok) {
        if (result.reason) {
          redirectToSignIn(result.reason === "invalid_session" ? "session_expired" : undefined);
          return;
        }
        setSaving(false);
        setSaveError(latest.completedAt ? REVIEW_SAVE_ERROR : SAVE_ERROR);
        return;
      }
      finish();
    } catch (err) {
      console.error("[done] 완료 기록 저장 실패:", err);
      setSaving(false);
      setSaveError(latest.completedAt ? REVIEW_SAVE_ERROR : SAVE_ERROR);
    }
  };

  const handleReview = () => save(stars > 0 ? stars : null, reactions);

  // 방문 완료가 이미 저장됐으면 서버에 보낼 게 없다. 저장되지 않은 구버전 흐름에서만
  // 후기 없이 완료 기록을 남긴다.
  const handleSkip = () => {
    if (started !== HYDRATING && started?.completedAt) {
      finish();
      return;
    }
    void save(null, []);
  };

  return {
    place,
    stars,
    setStars,
    reactions,
    toggleReaction,
    handleReview,
    handleSkip,
    saving,
    saveError,
  };
}
