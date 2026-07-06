"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Settings2,
  Clock,
  ChevronRight,
  AlertCircle,
  PartyPopper,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { Badge } from "@/components/commons/Badge";
import { Button } from "@/components/commons/Button";
import { PlaceDetailSheet } from "@/components/domains/course/PlaceDetailSheet";
import { usePrefsStore } from "@/client/stores/usePrefsStore";
import {
  useCourseProgressStore,
  MAX_REROLLS,
} from "@/client/stores/useCourseProgressStore";
import { generateCourseAction } from "@/app/actions/course";
import type { JourneyPlace, FestivalSummary, PendingCourse } from "@/shared/types/course.types";
import { PlaceThumbnail } from "@/components/domains/course/PlaceThumbnail";
import { NearbyRestaurants } from "@/components/domains/course/NearbyRestaurants";

const TRAVEL_REASON: Record<string, string> = {
  walk: "걷는 게 좋아요",
  min: "이동 최소화",
};

type Props = {
  courseId: string;
  courseName: string;
  place: JourneyPlace;
  festivals?: FestivalSummary[];
  isLoading?: boolean;
  mapX?: number;
  mapY?: number;
  scale?: string;
};

export function CourseResultView({
  courseId,
  courseName,
  place,
  festivals = [],
  isLoading = false,
  mapX,
  mapY,
  scale,
}: Props) {
  const [selectedPlace, setSelectedPlace] = useState<JourneyPlace | null>(null);
  const [rerolling, setRerolling] = useState(false);
  const [currentCourseId, setCurrentCourseId] = useState(courseId);
  const [currentPlace, setCurrentPlace] = useState<JourneyPlace>(place);
  const [currentCourseName, setCurrentCourseName] = useState(courseName);
  const [currentFestivals, setCurrentFestivals] = useState(festivals);
  const [rerollExhausted, setRerollExhausted] = useState(false);
  const [newPlaceId, setNewPlaceId] = useState<string | null>(null);

  const router = useRouter();
  const travelPref = usePrefsStore((s) => s.prefs.travel);
  const { prefs } = usePrefsStore();
  const startCourse = useCourseProgressStore((s) => s.start);
  const { rejectedPlaceIds, rerollCount, addRejection } =
    useCourseProgressStore();

  const isMaxRerolls = rerollCount >= MAX_REROLLS;

  const doReroll = async (excludeIds: string[]) => {
    if (!mapX || !mapY || !scale) return;
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
    setCurrentFestivals(result.festivals);

    if (result.place.id !== prevId) {
      setNewPlaceId(result.place.id);
      setTimeout(() => setNewPlaceId(null), 3000);
    }

    const pending: PendingCourse = {
      courseId: result.courseId,
      place: result.place,
      courseName: result.courseName,
      festivals: result.festivals,
      mapX,
      mapY,
      scale,
    };
    localStorage.setItem("pendingCourse", JSON.stringify(pending));
  };

  const handleReject = async (placeId: string, reason: string): Promise<void> => {
    console.log(`[reroll] 거절 — placeId: ${placeId}, reason: ${reason}`);
    addRejection(placeId);
    await doReroll([...rejectedPlaceIds, placeId]);
  };

  const handleStart = () => {
    startCourse(currentCourseId);
    router.push(`/course/${currentCourseId}/active`);
  };

  if (isLoading) {
    return <CourseResultSkeleton />;
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-2">
        {/* 헤더 */}
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight mb-1">
          {currentCourseName}
        </h1>
        <div className="flex items-center gap-2 mb-2.5">
          <Badge variant="accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block mr-1" />
            지금 출발 가능
          </Badge>
        </div>
        <div className="inline-flex self-start items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/8 text-primary text-[12px] font-medium mb-5">
          {`'${TRAVEL_REASON[travelPref] ?? travelPref}' 취향에 맞게 골랐어요`}
        </div>

        {/* 후보 소진 안내 */}
        {rerollExhausted && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-point/8 border border-point/20 mb-4">
            <AlertCircle size={16} className="text-point shrink-0 mt-0.5" />
            <p className="text-[13px] text-point leading-snug">
              이 근처에서 더 추천할 곳이 없어요. 반경을 넓혀보거나 위치를
              옮겨보세요.
            </p>
          </div>
        )}

        {/* 추천 장소 카드 */}
        <PlaceCardTimeline
          place={currentPlace}
          onClick={() => setSelectedPlace(currentPlace)}
          isNew={currentPlace.id === newPlaceId}
        />

        {/* 예상 체류 카드 */}
        {currentPlace.dur && (
          <div className="mt-3 p-4 rounded-xl bg-card flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/8 text-primary flex items-center justify-center shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-xs text-text-secondary">예상 체류</p>
              <p className="text-[15px] font-semibold text-text-primary">
                {currentPlace.dur}
              </p>
            </div>
          </div>
        )}

        {/* 보조 정보 — 근처 맛집 / 진행중 축제 (단일 장소 추천을 흐리지 않는 보조 수준) */}
        {(prefs.food === "matjip" || currentFestivals.length > 0) && (
          <div className="mt-3 flex flex-col gap-2.5">
            {prefs.food === "matjip" && (() => {
              const coord = currentPlace.coord ?? (mapX && mapY ? { lat: mapY, lng: mapX } : null);
              return coord ? (
                <NearbyRestaurants
                  placeName={currentPlace.name}
                  addr={currentPlace.addr}
                  coord={coord}
                />
              ) : null;
            })()}

            {currentFestivals.length > 0 && (
              <div className="p-3.5 rounded-xl bg-card border border-border">
                <p className="flex items-center gap-1.5 text-xs text-text-secondary mb-2.5">
                  <PartyPopper size={14} /> 주변 축제
                </p>
                <div className="flex flex-col gap-2.5">
                  {currentFestivals.slice(0, 3).map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-text-primary truncate">
                          {f.name}
                        </p>
                        <p className="text-[11px] text-text-secondary">{f.period}</p>
                      </div>
                      <Badge variant={f.status === "ongoing" ? "accent" : "outline"}>
                        {f.status === "ongoing" ? "진행중" : "예정"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CTA 바 */}
      <div className="border-t border-border bg-background px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,8px))] flex flex-col gap-2">
        <Button size="cta" className="w-full" onClick={handleStart}>
          이 코스로 갈게요
        </Button>
        <button
          onClick={() => router.push("/start")}
          className="w-full h-12 text-[15px] font-medium text-text-secondary flex items-center justify-center gap-1.5"
        >
          <Settings2 size={15} /> 취향 다시 설정
        </button>
      </div>

      <PlaceDetailSheet
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
        onReject={handleReject}
        rejectDisabled={isMaxRerolls || rerolling}
      />
    </>
  );
}

function PlaceCardTimeline({
  place,
  onClick,
  isNew = false,
}: {
  place: JourneyPlace;
  onClick: () => void;
  isNew?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3.5 rounded-xl bg-card border flex items-center justify-between gap-3 active:scale-[0.98] transition-all duration-200",
        isNew ? "border-primary ring-1 ring-primary/25" : "border-border",
      )}
    >
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-text-secondary">
            {place.cat}
          </span>
          {(place.tags.length > 0 ? place.tags.slice(0, 2) : [place.badge.text]).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded-full bg-primary/8 text-primary text-[10px] font-semibold"
            >
              {tag}
            </span>
          ))}
          {isNew && (
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
              새 장소
            </span>
          )}
        </div>
        <p className="text-[16px] font-bold text-text-primary tracking-tight truncate">
          {place.name}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <PlaceThumbnail
          imageUrl={place.imageUrl}
          cat={place.cat}
          className="w-14 h-14 rounded-lg"
          sizes="56px"
        />
        <ChevronRight size={14} className="text-text-secondary" />
      </div>
    </button>
  );
}

function CourseResultSkeleton() {
  return (
    <div className="flex-1 px-4 pt-5 pb-4 animate-pulse">
      <div className="h-7 w-48 rounded-lg bg-muted mb-2" />
      <div className="h-4 w-32 rounded bg-muted mb-5" />
      <div className="h-20 rounded-xl bg-muted" />
      <div className="mt-6 h-16 rounded-xl bg-muted" />
    </div>
  );
}
