"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { cn } from "@/shared/utils";
import { Button } from "@/components/commons/Button";
import { Badge } from "@/components/commons/Badge";
import { PlaceThumbnail } from "@/components/domains/course/PlaceThumbnail";
import { useClientRead, HYDRATING } from "@/client/hooks/useClientRead";
import { useCourseProgressStore } from "@/client/stores/useCourseProgressStore";
import { MOCK_PLACES } from "@/shared/constants/courseMock";
import { saveCourseCompletionAction } from "@/app/actions/completion";
import { buildCompletionPayload } from "@/shared/utils/completionPayload";
import type { PendingCourse } from "@/shared/types/course.types";

const REACTION_TAGS = [
  "분위기 좋아요",
  "혼자 오기 좋아요",
  "사진 맛집",
  "조용해요",
  "또 올래요",
];

function readPendingCourse(): Partial<PendingCourse> | null {
  try {
    const raw = localStorage.getItem("pendingCourse");
    if (!raw) return null;
    return JSON.parse(raw) as Partial<PendingCourse>;
  } catch {
    return null;
  }
}

export function CourseDoneView() {
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

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 pt-8 pb-4">
        {/* 완료 헤더 */}
        <div className="text-center mb-7">
          <div className="w-16 h-16 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} strokeWidth={2} />
          </div>
          <h1 className="text-[26px] font-bold text-text-primary tracking-tight mb-1.5">
            방문 완료!
          </h1>
          {place && (
            <p className="text-[14px] text-text-secondary">
              {place.name}은(는) 어떠셨나요?
            </p>
          )}
        </div>

        {/* 방문 장소 카드 */}
        {place && (
          <div className="flex items-center gap-3 rounded-xl bg-card border border-border px-4 py-3 mb-4">
            <PlaceThumbnail
              imageUrl={place.imageUrl}
              cat={place.cat}
              className="w-14 h-14 rounded-lg shrink-0"
              sizes="56px"
            />
            <div className="flex-1 min-w-0">
              <Badge variant="secondary">{place.cat}</Badge>
              <p className="text-[17px] font-bold text-text-primary tracking-tight mt-1 truncate">
                {place.name}
              </p>
            </div>
          </div>
        )}

        {/* 별점 */}
        <div className="mb-5">
          <p className="text-[15px] font-bold text-text-primary mb-3">별점</p>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} onClick={() => setStars(i)} className="p-1">
                <svg
                  viewBox="0 0 24 24"
                  className={cn(
                    "w-9 h-9 transition-colors",
                    i <= stars ? "fill-point text-point" : "fill-transparent text-border",
                  )}
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            ))}
          </div>
          <p className={cn(
            "text-[12px] text-center mt-2 transition-colors",
            stars > 0 ? "text-point font-semibold" : "text-text-secondary",
          )}>
            {stars === 0 && "별점을 남겨주세요"}
            {stars === 1 && "별로였어요"}
            {stars === 2 && "아쉬웠어요"}
            {stars === 3 && "보통이에요"}
            {stars === 4 && "좋았어요"}
            {stars === 5 && "최고였어요!"}
          </p>
        </div>

        {/* 반응 태그 */}
        <div className="mb-2">
          <p className="text-[15px] font-bold text-text-primary mb-3">
            어떤 점이 좋았나요? <span className="text-[13px] font-normal text-text-secondary">(선택)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {REACTION_TAGS.map((tag) => {
              const selected = reactions.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleReaction(tag)}
                  className={cn(
                    "px-4 py-2 rounded-full text-[13px] font-medium border transition-colors",
                    selected
                      ? "bg-primary text-white border-primary"
                      : "bg-transparent text-text-secondary border-border",
                  )}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CTA 바 */}
      <div className="border-t border-border bg-background px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,8px))] flex flex-col gap-2">
        <Button size="cta" onClick={handleDone} disabled={stars === 0}>
          후기 남기기
        </Button>
        <button
          onClick={handleDone}
          className="w-full h-12 text-[15px] font-medium text-text-secondary flex items-center justify-center"
        >
          그냥 넘기기
        </button>
      </div>
    </>
  );
}
