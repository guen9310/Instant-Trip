"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  ArrowRight,
  Navigation,
  Coffee,
  ShoppingBag,
  Plus,
  Droplets,
  FilterX,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { Badge } from "@/components/commons/Badge";
import { Button } from "@/components/commons/Button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/commons/Accordion";
import { MOCK_PLACES, MOCK_NEARBY } from "@/shared/constants/courseMock";
import { useCourseProgressStore } from "@/client/stores/useCourseProgressStore";
import type { NearbyCategory } from "@/shared/types/course.types";

type PoiMeta = {
  label: string;
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  color: string;
  bg: string;
};

const CATEGORY_META: Record<Exclude<NearbyCategory, "all">, PoiMeta> = {
  cafe: { label: "카페", icon: Coffee, color: "text-accent", bg: "bg-accent/10" },
  restroom: { label: "화장실", icon: Droplets, color: "text-secondary", bg: "bg-secondary/10" },
  convenience: { label: "편의점", icon: ShoppingBag, color: "text-point", bg: "bg-point/10" },
  pharmacy: { label: "약국", icon: Plus, color: "text-primary", bg: "bg-primary/10" },
};

const FILTER_CHIPS: { id: NearbyCategory; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "cafe", label: "카페" },
  { id: "restroom", label: "화장실" },
  { id: "convenience", label: "편의점" },
  { id: "pharmacy", label: "약국" },
];

export function CourseActiveView() {
  const places = MOCK_PLACES;
  const router = useRouter();
  const { courseId, currentIdx, advance } = useCourseProgressStore();

  // store에 진행 상태가 없으면 첫 번째 장소로 fallback
  const idx = courseId ? currentIdx : 0;
  const current = places[idx];
  const next = places[idx + 1];

  const handleAdvance = () => {
    if (idx >= places.length - 1) {
      router.push(`/course/${courseId ?? "1"}/done`);
    } else {
      advance();
    }
  };

  if (!current) return null;

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-[18px] font-bold text-text-primary tracking-tight">
            진행 중인 코스
          </h1>
          <StepDots total={places.length} current={idx} />
        </div>

        {/* 지도 플레이스홀더 */}
        <div className="h-40 rounded-xl border border-border bg-accent/9 relative overflow-hidden mb-4">
          <svg width="100%" height="100%" viewBox="0 0 343 160" className="absolute inset-0">
            <path
              d="M40 130 Q 110 60, 180 90 T 310 60"
              fill="none"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              className="stroke-accent"
            />
            <circle cx="40" cy="130" r="22" fillOpacity="0.18" className="fill-accent" />
          </svg>
          <div className="relative flex flex-col items-center justify-center h-full gap-1.5 text-accent">
            <MapPin size={28} strokeWidth={2.2} />
            <span className="text-[11px] font-semibold">현재 위치</span>
          </div>
        </div>

        {/* 현재 장소 카드 */}
        <Accordion multiple={false} className="mb-3">
          <AccordionItem
            value="nearby"
            className="rounded-xl bg-card border-l-4 border-primary"
          >
            <AccordionTrigger className="px-4 py-4 hover:no-underline items-center">
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[16px] font-bold text-text-primary">
                    {current.name}
                  </span>
                  <Badge variant="secondary">현재</Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                    {current.cat}
                  </span>
                  <span className="text-text-secondary">·</span>
                  <span className="text-xs text-text-secondary">{current.dur}</span>
                </div>
                <p className="text-[11px] text-accent font-medium mt-2">
                  주변 정보 보기
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4">
              <NearbyPanel placeId={current.id} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* 다음 장소 미리보기 */}
        {next && (
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.04em] mb-2.5">
              다음 장소
            </p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/8 text-primary flex items-center justify-center shrink-0">
                <Navigation size={16} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-text-primary tracking-tight mb-1">
                  {next.name}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant={next.badge.variant}>{next.cat}</Badge>
                  <span className="text-xs text-text-secondary">{next.travel}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CTA 바 */}
      <div className="border-t border-border bg-background px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,8px))]">
        <Button size="cta" className="w-full gap-2" onClick={handleAdvance}>
          {idx >= places.length - 1 ? "코스 완료" : "여기 완료, 다음으로"}
          <ArrowRight size={16} />
        </Button>
      </div>
    </>
  );
}

function NearbyPanel({ placeId }: { placeId: string }) {
  const [cat, setCat] = useState<NearbyCategory>("all");
  const all = MOCK_NEARBY[placeId] ?? [];
  const filtered = cat === "all" ? all : all.filter((p) => p.category === cat);

  return (
    <div className="pb-3">
      {/* 카테고리 필터 칩 */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setCat(chip.id)}
            className={cn(
              "shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors",
              cat === chip.id
                ? "bg-primary text-white border-primary"
                : "bg-transparent text-text-secondary border-border",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* 주변 장소 목록 */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-2.5 mt-1">
          {filtered.map((poi) => {
            const meta = CATEGORY_META[poi.category];
            const Icon = meta.icon;
            return (
              <div key={poi.id} className="flex items-center gap-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", meta.bg)}>
                  <Icon size={14} strokeWidth={2.2} className={meta.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-text-primary truncate">
                    {poi.name}
                  </p>
                  <p className="text-[11px] text-text-secondary">{poi.dist}</p>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                    poi.isOpen ? "bg-accent/10 text-accent" : "bg-border text-text-secondary",
                  )}
                >
                  {poi.isOpen ? "영업중" : "영업종료"}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-4 mt-1">
          <FilterX size={20} className="text-text-secondary" strokeWidth={1.5} />
          <p className="text-[12px] text-text-secondary">
            {cat === "all" ? "주변에 표시할 장소가 없어요" : `근처에 ${FILTER_CHIPS.find((c) => c.id === cat)?.label}가 없어요`}
          </p>
          {cat !== "all" && (
            <button
              onClick={() => setCat("all")}
              className="text-[12px] font-semibold text-primary"
            >
              전체 보기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "rounded-full transition-all",
            i < current
              ? "w-2 h-2 bg-primary/30"
              : i === current
                ? "w-4 h-2 bg-primary"
                : "w-2 h-2 bg-border",
          )}
        />
      ))}
    </div>
  );
}
