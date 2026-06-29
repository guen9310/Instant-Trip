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
import { Sheet, SheetContent } from "@/components/commons/Sheet";
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
  /** 거절 이유 선택 후 "여기 말고 다른 곳으로" 클릭 시 호출 */
  onReject?: (placeId: string, reason: string) => void;
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
    <Sheet
      open={!!place}
      onOpenChange={(open: boolean) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="p-0 rounded-t-[20px] max-h-[90dvh] gap-0 overflow-hidden"
      >
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-2 pb-3.5">
          <div className="w-9 h-1 rounded-full bg-border" />
        </div>
        {/* key를 place.id로 두어 장소 변경 시 내부 상태 자동 리셋 */}
        {place && (
          <PlaceDetailContent
            key={place.id}
            place={place}
            onClose={onClose}
            onReject={onReject}
            rejectDisabled={rejectDisabled}
          />
        )}
      </SheetContent>
    </Sheet>
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
  const [isRejecting, setIsRejecting] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [descHasMore, setDescHasMore] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

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

  const handleToggleDesc = () => {
    if (isDescExpanded && descRef.current) {
      descRef.current.scrollTop = 0;
    }
    setIsDescExpanded(!isDescExpanded);
  };

  const handleConfirmReject = () => {
    if (!reason) return;
    onReject?.(place.id, reason);
    onClose();
  };

  return (
    <div className="overflow-hidden relative">
      <div
        className="flex transition-transform duration-250 ease-in-out"
        style={{
          transform: isRejecting ? "translateX(-50%)" : "translateX(0)",
          width: "200%",
        }}
      >
        {/* 기본 패널 */}
        <div className="w-1/2 pb-5 box-border">
          <div className="px-5">
            <PlaceThumbnail
              imageUrl={place.imageUrl}
              cat={place.cat}
              className="w-full h-44 rounded-xl"
              sizes="50vw"
            />
          </div>
          <div className="px-5 pt-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <Badge variant={place.badge.variant}>{place.cat}</Badge>
                <h2 className="text-[22px] font-bold text-text-primary tracking-tight mt-2">
                  {place.name}
                </h2>
              </div>
              {/* <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-text-primary shrink-0 mt-0.5"
              >
                <X size={18} />
              </button> */}
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

            <div className="flex flex-col gap-2 mt-5">
              <button
                onClick={() => !rejectDisabled && setIsRejecting(true)}
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
            </div>
          </div>
          {/* /px-5 pt-3 */}
        </div>

        {/* 거절 패널 */}
        <div className="w-1/2 px-5 pt-3 pb-5 box-border">
          <button
            onClick={() => setIsRejecting(false)}
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

          <div className="flex flex-col gap-2 mt-5">
            <p className="text-[11px] text-muted-foreground text-center">
              거절한 장소는 다음 코스에서 제외됩니다
            </p>
            <Button size="cta" disabled={!reason} onClick={handleConfirmReject}>
              여기 말고 다른 곳으로
            </Button>
          </div>
        </div>
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
