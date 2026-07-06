"use client";

import { useState, useRef, useEffect } from "react";
import {
  MapPin,
  Clock,
  Calendar,
  ThumbsDown,
  ChevronLeft,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import type { ElementType } from "react";
import { cn } from "@/shared/utils";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/commons/Drawer";
import { Badge } from "@/components/commons/Badge";
import { Button } from "@/components/commons/Button";
import type { JourneyPlace } from "@/shared/types/course.types";
import { PlaceThumbnail } from "@/components/domains/course/PlaceThumbnail";

const REJECT_REASONS = [
  { id: "far", icon: MapPin, label: "너무 멀어요" },
  { id: "taste", icon: ThumbsDown, label: "취향이 아니에요" },
  { id: "visited", icon: Calendar, label: "이미 가봤어요" },
  { id: "time", icon: Clock, label: "시간이 안 맞아요" },
] as const;

type Props = {
  place: JourneyPlace | null;
  onClose: () => void;
  /** 거절 이유 선택 후 "여기 말고 다른 곳으로" 클릭 시 호출 — await 완료 후 시트 닫힘 */
  onReject?: (placeId: string, reason: string) => Promise<void>;
  /** true이면 거절 기능 비활성화 (maxRerolls 도달 시) */
  rejectDisabled?: boolean;
};

export function PlaceDetailSheet({
  place,
  onClose,
  onReject,
  rejectDisabled,
}: Props) {
  return (
    <Drawer open={!!place} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DrawerContent className="h-[90dvh]">
        <DrawerTitle className="sr-only">{place?.name ?? "장소 상세"}</DrawerTitle>
        {place && (
          <PlaceDetailContent
            key={place.id}
            place={place}
            onClose={onClose}
            onReject={onReject}
            rejectDisabled={rejectDisabled}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

function PlaceDetailContent({
  place,
  onClose,
  onReject,
  rejectDisabled,
}: {
  place: JourneyPlace;
  onClose: () => void;
  onReject?: (placeId: string, reason: string) => void;
  rejectDisabled?: boolean;
}) {
  const [phase, setPhase] = useState<"default" | "rejecting" | "submitting">("default");
  const [reason, setReason] = useState<string | null>(null);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [descHasMore, setDescHasMore] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);
  const roadviewRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"photo" | "roadview">("photo");
  const [roadviewAvailable, setRoadviewAvailable] = useState(false);

  useEffect(() => {
    const el = descRef.current;
    if (el) {
      if (el.scrollHeight > el.clientHeight) {
        setDescHasMore(true);
      } else {
        setDescHasMore(false);
      }
    }
  }, [place.desc]);

  // 로드뷰 커버리지 확인 — coord 없으면 스킵
  useEffect(() => {
    if (!place.coord) return;
    const win = window as unknown as { kakao?: { maps?: { load?: (cb: () => void) => void } } };
    win.kakao?.maps?.load?.(() => {
      const pos = new kakao.maps.LatLng(place.coord!.lat, place.coord!.lng);
      const client = new kakao.maps.RoadviewClient();
      client.getNearestPanoId(pos, 50, (panoId) => {
        setRoadviewAvailable(panoId > 0);
      });
    });
  }, [place.coord]);

  // 거리뷰 모드 진입 시 Roadview 초기화
  useEffect(() => {
    if (viewMode !== "roadview" || !roadviewRef.current || !place.coord) return;
    const win = window as unknown as { kakao?: { maps?: { load?: (cb: () => void) => void } } };
    win.kakao?.maps?.load?.(() => {
      if (!roadviewRef.current) return;
      const pos = new kakao.maps.LatLng(place.coord!.lat, place.coord!.lng);
      const rv = new kakao.maps.Roadview(roadviewRef.current);
      const client = new kakao.maps.RoadviewClient();
      client.getNearestPanoId(pos, 50, (panoId) => {
        rv.setPanoId(panoId, pos);
        requestAnimationFrame(() => rv.relayout());
      });
    });
  }, [viewMode, place.coord]);

  const handleToggleDesc = () => {
    if (isDescExpanded && descRef.current) {
      descRef.current.scrollTop = 0;
    }
    setIsDescExpanded(!isDescExpanded);
  };

  const handleConfirmReject = async () => {
    if (!reason) return;
    setPhase("submitting");
    await onReject?.(place.id, reason);
    onClose();
  };

  if (phase === "submitting") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-0">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-[14px] text-text-secondary">새로운 장소를 찾는 중...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 슬라이딩 패널 — 스크롤 영역 */}
      <div className="overflow-hidden relative flex-1 min-h-0">
        <div
          className="flex transition-transform duration-250 ease-in-out h-full"
          style={{
            transform: phase === "rejecting" ? "translateX(-50%)" : "translateX(0)",
            width: "200%",
          }}
        >
          {/* 기본 패널 */}
          <div className="w-1/2 overflow-y-auto pb-4">
            <div className="relative px-5">
              {viewMode === "photo" ? (
                <PlaceThumbnail
                  imageUrl={place.imageUrl}
                  cat={place.cat}
                  className="w-full h-44 rounded-xl"
                  sizes="50vw"
                />
              ) : (
                <div ref={roadviewRef} data-vaul-no-drag className="w-full h-64 rounded-xl overflow-hidden" />
              )}
              {roadviewAvailable && (
                <div className="absolute top-2 right-7 flex rounded-lg overflow-hidden border border-border bg-background/90 shadow-sm backdrop-blur-sm">
                  <button
                    onClick={() => setViewMode("photo")}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium transition-colors",
                      viewMode === "photo" ? "bg-primary text-white" : "text-text-secondary",
                    )}
                  >
                    사진
                  </button>
                  <button
                    onClick={() => setViewMode("roadview")}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium transition-colors",
                      viewMode === "roadview" ? "bg-primary text-white" : "text-text-secondary",
                    )}
                  >
                    거리뷰
                  </button>
                </div>
              )}
            </div>
            <div className="px-5 pt-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <Badge variant="secondary">{place.cat}</Badge>
                  <h2 className="text-[22px] font-bold text-text-primary tracking-tight mt-2">
                    {place.name}
                  </h2>
                  {place.tags.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {place.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 rounded-full bg-card border border-border text-[11px] font-medium text-text-secondary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2.5 mt-4">
                <DetailRow icon={MapPin} label={place.addr} />
                {place.hours?.trim() && (
                  <DetailRow icon={Clock} label={`영업시간 ${place.hours}`} />
                )}
                {(place.time?.trim() || place.dur?.trim()) && (
                  <DetailRow
                    icon={Calendar}
                    label={[
                      place.time?.trim(),
                      place.dur?.trim() && `${place.dur} 머무름`,
                    ]
                      .filter(Boolean)
                      .join(" 도착 · ")}
                  />
                )}
              </div>

              {place.desc?.trim() && (
                <>
                  <div className="h-px bg-border my-4" />
                  <div className="flex flex-col gap-1">
                    <p
                      ref={descRef}
                      className={cn(
                        "text-[14px] text-text-primary leading-[1.55] break-all",
                        !isDescExpanded && "line-clamp-4",
                        isDescExpanded && "max-h-[160px] overflow-y-auto pr-1",
                      )}
                    >
                      {place.desc}
                    </p>
                    <div className="flex justify-end">
                      {descHasMore && (
                        <button
                          onClick={handleToggleDesc}
                          className="text-primary text-xs font-semibold hover:underline mt-1"
                        >
                          {isDescExpanded ? "접기" : "더 보기"}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {place.availabilityUncertain && (
                <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle
                      size={15}
                      className="text-amber-500 shrink-0 mt-0.5"
                    />
                    <p className="text-[13px] text-amber-800 leading-snug">
                      영업시간·휴무는 변동될 수 있어요. 방문 전 확인을 권장합니다.
                    </p>
                  </div>
                  <a
                    href={`https://map.kakao.com/?q=${encodeURIComponent(place.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full h-9 rounded-lg bg-amber-100 text-amber-800 text-[13px] font-medium"
                  >
                    <ExternalLink size={13} /> 영업시간 확인
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* 거절 패널 */}
          <div className="w-1/2 px-5 pt-3 pb-4 overflow-y-auto">
            <button
              onClick={() => setPhase("default")}
              className="flex items-center gap-1 text-text-secondary text-[14px] font-medium mb-3.5"
            >
              <ChevronLeft size={18} /> 돌아가기
            </button>
            <h2 className="text-[20px] font-bold text-text-primary tracking-tight mb-1">
              어떤 점이 마음에 안 드셨나요?
            </h2>
            <p className="text-[13px] text-text-secondary mb-5">{place.name}</p>

            <div className="grid grid-cols-2 gap-2">
              {REJECT_REASONS.map((r) => {
                const sel = reason === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setReason(r.id)}
                    className={cn(
                      "p-3.5 rounded-[10px] border flex flex-col items-center gap-2 transition-colors",
                      sel
                        ? "bg-primary/5 border-primary text-primary"
                        : "bg-background border-border text-text-secondary",
                    )}
                  >
                    <r.icon size={20} />
                    <span className="text-[13px] font-medium">{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 고정 푸터 — 스크롤 여부와 무관하게 항상 표시 */}
      <div className="shrink-0 border-t border-border px-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom,8px))] flex flex-col gap-2">
        {phase === "default" && (
          <>
            <button
              onClick={() => !rejectDisabled && setPhase("rejecting")}
              disabled={rejectDisabled}
              className={cn(
                "w-full h-12 rounded-lg border border-border text-point text-[14px] font-medium flex items-center justify-center gap-1.5",
                rejectDisabled && "opacity-40 cursor-not-allowed",
              )}
            >
              <ThumbsDown size={15} /> 이런 곳은 싫어요
            </button>
            <Button size="cta" onClick={onClose}>
              확인
            </Button>
          </>
        )}
        {phase === "rejecting" && (
          <>
            <p className="text-[11px] text-muted-foreground text-center">
              거절한 장소는 다음 코스에서 제외됩니다
            </p>
            <Button size="cta" disabled={!reason} onClick={handleConfirmReject}>
              여기 말고 다른 곳으로
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function DetailRow({ icon: Ico, label }: { icon: ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Ico size={16} className="text-text-secondary shrink-0" />
      <span className="text-[14px] text-text-primary">{label}</span>
    </div>
  );
}
