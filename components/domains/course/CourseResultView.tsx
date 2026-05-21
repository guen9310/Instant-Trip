"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCcw, Clock, ChevronRight } from "lucide-react";
import { CourseLoadingOverlay } from "@/components/domains/course/CourseLoadingOverlay";
import { cn } from "@/shared/utils";
import { Badge } from "@/components/commons/Badge";
import { Button } from "@/components/commons/Button";
import { PlaceDetailSheet } from "@/components/domains/course/PlaceDetailSheet";
import { MOCK_PLACES } from "@/shared/constants/courseMock";
import { usePrefsStore } from "@/client/stores/usePrefsStore";
import type { JourneyPlace } from "@/shared/types/course.types";

const TRAVEL_REASON: Record<string, string> = {
  walk: "걷는 게 좋아요",
  min: "이동 최소화",
};

export function CourseResultView() {
  const [selectedJourneyPlace, setSelectedJourneyPlace] = useState<JourneyPlace | null>(null);
  const [loading, setLoading] = useState(false);
  const places = MOCK_PLACES;
  const travelPref = usePrefsStore((s) => s.prefs.travel);

  const handleReroll = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 2500));
    setLoading(false);
  };

  return (
    <>
      {loading && <CourseLoadingOverlay />}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4">
        {/* 헤더 */}
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight mb-1">
          적당히 즐기는 코스
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
          {`'${TRAVEL_REASON[travelPref]}' 취향에 맞게 골랐어요`}
        </div>

        {/* 타임라인 레이아웃 */}
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
              <JourneyPlaceCardTimeline
                place={p}
                onClick={() => setSelectedJourneyPlace(p)}
              />
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
        <Link href="/course/1/active" className="block">
          <Button size="cta" className="w-full">
            이 코스로 갈게요
          </Button>
        </Link>
        <button
          onClick={handleReroll}
          className="w-full h-12 text-[15px] font-medium text-text-primary flex items-center justify-center gap-1.5"
        >
          <RefreshCcw size={15} /> 다시 뽑기
        </button>
      </div>

      <PlaceDetailSheet
        place={selectedJourneyPlace}
        onClose={() => setSelectedJourneyPlace(null)}
      />
    </>
  );
}

function JourneyPlaceCardTimeline({
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
