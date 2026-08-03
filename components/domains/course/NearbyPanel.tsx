"use client";

import { useState } from "react";
import {
  Coffee,
  ShoppingBag,
  Pill,
  FilterX,
  ExternalLink,
  Utensils,
  SquareParking,
  Fuel,
} from "lucide-react";
import { CourseMap } from "@/components/domains/course/CourseMap";
import { cn } from "@/shared/utils";
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
  pharmacy:    { label: "약국",   icon: Pill,          color: "text-primary",    bg: "bg-primary/10" },
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

type NearbyPanelProps = {
  placeName: string;
  placeCoord: { lat: number; lng: number } | null;
  cat: NearbyCategory;
  setCat: (cat: NearbyCategory) => void;
  pois: NearbyPoi[];
  loading: boolean;
  selectedPoiId: string | null;
  onSelect: (id: string | null) => void;
};

export function NearbyPanel({
  placeName,
  placeCoord,
  cat,
  setCat,
  pois,
  loading,
  selectedPoiId,
  onSelect,
}: NearbyPanelProps) {
  // CourseMap이 올려주는 현재 지도 뷰포트 경계 — 하단 리스트를 지금 지도 화면에
  // 실제로 보이는 장소만으로 좁혀, 지도와 리스트가 항상 같은 내용을 보여주게 한다.
  const [viewportBounds, setViewportBounds] = useState<{
    sw: { lat: number; lng: number };
    ne: { lat: number; lng: number };
  } | null>(null);
  // 지도에서 장소 하나를 선택하면(CourseMap도 동일한 기준으로 마커를 그 하나로
  // 좁힌다) 리스트도 그 장소 하나만 남긴다 — 지도는 좁혀졌는데 리스트는 여전히
  // 전체가 보이면 지도·리스트가 서로 다른 걸 보여주는 것처럼 느껴지기 때문.
  const visiblePois = selectedPoiId
    ? pois.filter((p) => p.id === selectedPoiId)
    : viewportBounds
      ? pois.filter(
          (p) =>
            p.coord.lat >= viewportBounds.sw.lat &&
            p.coord.lat <= viewportBounds.ne.lat &&
            p.coord.lng >= viewportBounds.sw.lng &&
            p.coord.lng <= viewportBounds.ne.lng,
        )
      : pois;

  return (
    <div className="pb-4">
      {/* 지도 카드 — 현재 장소 + 필터링된 POI 마커, 리스트 탭과 선택 상태를 공유.
          표시 모드 세그먼트·범례·길찾기까지 카드 전체를 CourseMap이 자체적으로 소유·관리한다. */}
      {placeCoord && (
        <div className="mb-3">
          <CourseMap
            mainPlace={{ name: placeName, coord: placeCoord }}
            pois={pois}
            selectedPoiId={selectedPoiId}
            onSelectPoi={onSelect}
            onViewportChange={setViewportBounds}
          />
        </div>
      )}

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
        현재 장소 기준
      </p>

      {/* 리스트 전용 스크롤 영역 — 페이지 전체 스크롤과 분리해, 장소가 많아도
          여기서만 스크롤되고 위쪽 사진·정보 카드는 그대로 고정돼 있다. 스크롤바는
          globals.css의 전역 규칙(모든 overflow 영역 공통)을 그대로 물려받는다 —
          여기만 따로 스타일링하지 않는다. 높이는 감으로 잡아둔 값이라 조절 가능. */}
      <div className="h-72 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && (visiblePois.length > 0 ? (
          <div className="flex flex-col gap-2.5 mt-1">
            {visiblePois.map((poi) => {
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
              {pois.length === 0
                ? cat === "all"
                  ? "주변에 표시할 장소가 없어요"
                  : `근처에 ${FILTER_CHIPS.find((c) => c.id === cat)?.label}가 없어요`
                : "지도에 보이는 장소가 없어요 · 지도를 움직여보세요"}
            </p>
            {pois.length === 0 && cat !== "all" && (
              <button onClick={() => setCat("all")} className="text-[12px] font-semibold text-primary">
                전체 보기
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
