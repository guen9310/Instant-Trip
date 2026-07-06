"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ChevronUp,
  Coffee,
  ShoppingBag,
  Plus,
  FilterX,
  ExternalLink,
  Utensils,
  SquareParking,
  Fuel,
  Check,
  MapPin,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { Badge } from "@/components/commons/Badge";
import { Button } from "@/components/commons/Button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/commons/Drawer";
import { useCourseActive } from "@/client/hooks/useCourseActive";
import type { NearbyCategory, NearbyPoi } from "@/shared/types/course.types";

type PoiMeta = {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  color: string;
  bg: string;
};

const CATEGORY_META: Record<Exclude<NearbyCategory, "all">, PoiMeta> = {
  cafe:        { label: "카페",   icon: Coffee,        color: "text-accent",     bg: "bg-accent/10" },
  convenience: { label: "편의점", icon: ShoppingBag,   color: "text-point",      bg: "bg-point/10" },
  pharmacy:    { label: "약국",   icon: Plus,          color: "text-primary",    bg: "bg-primary/10" },
  restaurant:  { label: "음식점", icon: Utensils,      color: "text-orange-500", bg: "bg-orange-500/10" },
  parking:     { label: "주차장", icon: SquareParking, color: "text-sky-500",    bg: "bg-sky-500/10" },
  gas_station: { label: "주유소", icon: Fuel,          color: "text-yellow-500", bg: "bg-yellow-500/10" },
};

const FILTER_CHIPS: { id: NearbyCategory; label: string }[] = [
  { id: "all",         label: "전체" },
  { id: "cafe",        label: "카페" },
  { id: "convenience", label: "편의점" },
  { id: "pharmacy",    label: "약국" },
  { id: "restaurant",  label: "음식점" },
  { id: "parking",     label: "주차장" },
  { id: "gas_station", label: "주유소" },
];

export function CourseActiveView({ courseId }: { courseId: string }) {
  const state = useCourseActive(courseId);
  const [nearbyOpen, setNearbyOpen] = useState(false);

  if (state.status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { place, cat, setCat, filteredPois, poisLoading, selectedPoiId, selectPoi, handleComplete } = state;

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {/* 장소 이미지 */}
        <div className="relative h-52 bg-card overflow-hidden shrink-0">
          {place.imageUrl ? (
            <Image
              src={place.imageUrl}
              alt={place.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-end justify-end p-3">
              <span className="text-[11px] text-text-secondary/40">장소 이미지</span>
            </div>
          )}
          <div className="absolute top-3 left-3">
            <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="text-[12px] font-semibold text-text-primary">지금 여기</span>
            </div>
          </div>
        </div>

        {/* 장소 정보 */}
        <div className="px-4 pt-4 pb-2 flex flex-col gap-3">
          {/* 카테고리 + 정보 불확실 경고 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{place.cat}</Badge>
            {place.availabilityUncertain && (
              <div className="flex items-center gap-1 text-point">
                <AlertTriangle size={12} strokeWidth={2} />
                <span className="text-[11px] font-medium">정보가 정확하지 않을 수 있어요</span>
              </div>
            )}
          </div>

          {/* 장소명 + 현재 배지 */}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[26px] font-bold text-text-primary leading-tight tracking-tight">
              {place.name}
            </h1>
            <Badge variant="secondary">현재</Badge>
          </div>

          {/* 주소 */}
          {place.addr && (
            <div className="flex items-start gap-1.5">
              <MapPin size={13} strokeWidth={2} className="text-text-secondary shrink-0 mt-0.5" />
              <span className="text-[13px] text-text-secondary leading-snug">{place.addr}</span>
            </div>
          )}

          {/* 설명 */}
          {place.desc && (
            <p className="text-[14px] text-text-secondary leading-relaxed">{place.desc}</p>
          )}

          {/* 체류 시간 카드 */}
          <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Clock size={15} strokeWidth={2} className="text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide mb-0.5">
                권장 체류 시간
              </p>
              <p className="text-[15px] font-bold text-text-primary">{place.dur}</p>
            </div>
          </div>

          {/* 태그 칩 */}
          {place.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {place.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full bg-card border border-border text-[12px] font-medium text-text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 주변 보기 버튼 */}
        <button
          type="button"
          onClick={() => setNearbyOpen(true)}
          className="flex items-center justify-center gap-2 w-full py-4 border-t border-border mt-2 text-text-secondary active:bg-card transition-colors"
        >
          <ChevronUp size={14} strokeWidth={2.5} className="text-text-secondary/50" />
          <span className="text-[12px] font-semibold">주변 정보 보기</span>
          {poisLoading && (
            <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
          )}
          {!poisLoading && filteredPois.length > 0 && (
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
              {filteredPois.length}
            </span>
          )}
        </button>
      </div>

      {/* CTA 바 */}
      <div className="border-t border-border bg-background px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,8px))] shrink-0">
        <Button size="cta" className="w-full gap-2" onClick={handleComplete}>
          방문 완료
          <Check size={16} />
        </Button>
      </div>

      {/* 주변 정보 Drawer */}
      <Drawer open={nearbyOpen} onOpenChange={setNearbyOpen}>
        <DrawerContent className="h-[70dvh]">
          <DrawerTitle className="px-4 pb-1">주변</DrawerTitle>
          <div
            data-vaul-no-drag
            className="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom,12px)]"
          >
            <NearbyPanel
              cat={cat}
              setCat={setCat}
              pois={filteredPois}
              loading={poisLoading}
              selectedPoiId={selectedPoiId}
              onSelect={selectPoi}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

type NearbyPanelProps = {
  cat: NearbyCategory;
  setCat: (cat: NearbyCategory) => void;
  pois: NearbyPoi[];
  loading: boolean;
  selectedPoiId: string | null;
  onSelect: (id: string | null) => void;
};

function NearbyPanel({ cat, setCat, pois, loading, selectedPoiId, onSelect }: NearbyPanelProps) {
  return (
    <div className="pb-4">
      <div className="relative">
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
        <div className="pointer-events-none absolute right-0 top-0 h-[calc(100%-8px)] w-8 bg-linear-to-l from-background to-transparent" />
      </div>

      <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide mb-2 mt-1">
        현재 위치 기준
      </p>

      {loading && (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {!loading && (pois.length > 0 ? (
        <div className="flex flex-col gap-2.5 mt-1">
          {pois.map((poi) => {
            const meta = CATEGORY_META[poi.category];
            const Icon = meta.icon;
            const isSelected = selectedPoiId === poi.id;
            return (
              <button
                key={poi.id}
                type="button"
                onClick={() => onSelect(isSelected ? null : poi.id)}
                aria-pressed={isSelected}
                className={cn(
                  "flex items-center gap-3 w-full text-left rounded-lg px-2 py-1.5 transition-colors border",
                  isSelected ? "bg-primary/8 border-primary/30" : "border-transparent",
                )}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", meta.bg)}>
                  <Icon size={14} strokeWidth={2.2} className={meta.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-text-primary truncate">{poi.name}</p>
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
                <a
                  href={poi.placeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 text-text-secondary hover:text-primary transition-colors p-1"
                >
                  <ExternalLink size={13} strokeWidth={2} />
                </a>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-6 mt-1">
          <FilterX size={20} className="text-text-secondary" strokeWidth={1.5} />
          <p className="text-[12px] text-text-secondary">
            {cat === "all"
              ? "주변에 표시할 장소가 없어요"
              : `근처에 ${FILTER_CHIPS.find((c) => c.id === cat)?.label}가 없어요`}
          </p>
          {cat !== "all" && (
            <button onClick={() => setCat("all")} className="text-[12px] font-semibold text-primary">
              전체 보기
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
