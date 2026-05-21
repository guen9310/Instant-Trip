"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Clock, ChevronRight, AlertCircle } from "lucide-react";
import { CourseLoadingOverlay } from "@/components/domains/course/CourseLoadingOverlay";
import { cn } from "@/shared/utils";
import { Badge } from "@/components/commons/Badge";
import { Button } from "@/components/commons/Button";
import { PlaceDetailSheet } from "@/components/domains/course/PlaceDetailSheet";
import { usePrefsStore } from "@/client/stores/usePrefsStore";
import { useCourseProgressStore } from "@/client/stores/useCourseProgressStore";
import type { JourneyPlace } from "@/shared/types/course.types";

const TRAVEL_REASON: Record<string, string> = {
  walk: "걷는 게 좋아요",
  min: "이동 최소화",
};

type Props = {
  courseId: string;
  courseName: string;
  places: JourneyPlace[];
  isLoading?: boolean;
};

export function CourseResultView({
  courseId,
  courseName,
  places,
  isLoading = false,
}: Props) {
  const [selectedPlace, setSelectedPlace] = useState<JourneyPlace | null>(null);
  const [rerolling, setRerolling] = useState(false);
  const router = useRouter();
  const travelPref = usePrefsStore((s) => s.prefs.travel);
  const startCourse = useCourseProgressStore((s) => s.start);

  const handleReroll = async () => {
    setRerolling(true);
    // TODO: 코스 재생성 API 호출로 교체
    await new Promise((r) => setTimeout(r, 2500));
    setRerolling(false);
  };

  const handleStart = () => {
    startCourse(courseId, places.length);
    router.push(`/course/${courseId}/active`);
  };

  if (isLoading) {
    return <CourseResultSkeleton />;
  }

  if (places.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12">
        <div className="w-14 h-14 rounded-full bg-point/10 flex items-center justify-center">
          <AlertCircle size={28} className="text-point" strokeWidth={2} />
        </div>
        <div className="text-center">
          <p className="text-[16px] font-bold text-text-primary mb-1">
            코스 생성에 실패했어요
          </p>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            조건에 맞는 코스를 찾지 못했어요
          </p>
        </div>
        <Button onClick={handleReroll} disabled={rerolling} className="gap-2">
          <RefreshCcw size={15} /> 다시 시도
        </Button>
      </div>
    );
  }

  return (
    <>
      {rerolling && <CourseLoadingOverlay />}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4">
        {/* 헤더 */}
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight mb-1">
          {courseName}
        </h1>
        <div className="flex items-center gap-2 mb-2.5">
          <Badge variant="accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block mr-1" />
            지금 출발 가능
          </Badge>
          <span className="text-xs text-text-secondary">
            총 약 3시간 · 이동 포함
          </span>
        </div>
        <div className="inline-flex self-start items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/8 text-primary text-[12px] font-medium mb-5">
          {`'${TRAVEL_REASON[travelPref] ?? travelPref}' 취향에 맞게 골랐어요`}
        </div>

        {/* 타임라인 */}
        <div className="relative pl-8">
          <div className="absolute left-[13px] top-2.5 bottom-2.5 w-0.5 bg-border rounded-full" />
          {places.map((p, i) => (
            <div
              key={p.id}
              className={cn("relative", i < places.length - 1 ? "mb-3.5" : "")}
            >
              <div className="absolute -left-8 top-2.5 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold border-[3px] border-background z-10">
                {i + 1}
              </div>
              <PlaceCardTimeline place={p} onClick={() => setSelectedPlace(p)} />
            </div>
          ))}
        </div>

        {/* 총 소요 카드 */}
        <div className="mt-6 p-4 rounded-xl bg-card flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/8 text-primary flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-xs text-text-secondary">총 소요</p>
            <p className="text-[15px] font-semibold text-text-primary">
              약 3시간 · 이동 포함
            </p>
          </div>
        </div>
      </div>

      {/* CTA 바 */}
      <div className="border-t border-border bg-background px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,8px))] flex flex-col gap-2">
        <Button size="cta" className="w-full" onClick={handleStart}>
          이 코스로 갈게요
        </Button>
        <button
          onClick={handleReroll}
          disabled={rerolling}
          className="w-full h-12 text-[15px] font-medium text-text-primary flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <RefreshCcw size={15} /> 다시 뽑기
        </button>
      </div>

      <PlaceDetailSheet
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
      />
    </>
  );
}

function PlaceCardTimeline({
  place,
  onClick,
}: {
  place: JourneyPlace;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3.5 rounded-xl bg-card border border-border flex flex-col gap-1.5 active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-text-secondary">
          {place.cat}
        </span>
        <div className="flex items-center gap-1.5">
          <Badge variant={place.badge.variant}>{place.badge.text}</Badge>
          <ChevronRight size={14} className="text-text-secondary" />
        </div>
      </div>
      <p className="text-[16px] font-bold text-text-primary tracking-tight">
        {place.name}
      </p>
      <p className="text-xs text-text-secondary">
        <span className="font-semibold text-text-primary">{place.time}</span> ·{" "}
        {place.dur} · {place.travel}
      </p>
    </button>
  );
}

function CourseResultSkeleton() {
  return (
    <div className="flex-1 px-4 pt-5 pb-4 animate-pulse">
      <div className="h-7 w-48 rounded-lg bg-muted mb-2" />
      <div className="h-4 w-32 rounded bg-muted mb-5" />
      <div className="relative pl-8">
        <div className="absolute left-[13px] top-2.5 bottom-2.5 w-0.5 bg-border rounded-full" />
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn("relative", i < 2 ? "mb-3.5" : "")}>
            <div className="absolute -left-8 top-2.5 w-7 h-7 rounded-full bg-muted border-[3px] border-background z-10" />
            <div className="h-20 rounded-xl bg-muted" />
          </div>
        ))}
      </div>
      <div className="mt-6 h-16 rounded-xl bg-muted" />
    </div>
  );
}
