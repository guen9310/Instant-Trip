"use client";

import {
  Navigation,
  Coffee,
  ShoppingBag,
  Plus,
  FilterX,
  ExternalLink,
  Utensils,
  SquareParking,
  Fuel,
  Check,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { Badge } from "@/components/commons/Badge";
import { Button } from "@/components/commons/Button";
import { CourseMap, CourseMapPlaceholder } from "@/components/domains/course/CourseMap";
import { useCourseActive } from "@/client/hooks/useCourseActive";
import type { NearbyCategory, NearbyPoi } from "@/shared/types/course.types";

type PoiMeta = {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  color: string;
  bg: string;
};

const CATEGORY_META: Record<Exclude<NearbyCategory, "all">, PoiMeta> = {
  cafe:        { label: "카페",   icon: Coffee,         color: "text-accent",   bg: "bg-accent/10" },
  convenience: { label: "편의점", icon: ShoppingBag,    color: "text-point",    bg: "bg-point/10" },
  pharmacy:    { label: "약국",   icon: Plus,           color: "text-primary",  bg: "bg-primary/10" },
  restaurant:  { label: "음식점", icon: Utensils,       color: "text-orange-500", bg: "bg-orange-500/10" },
  parking:     { label: "주차장", icon: SquareParking,  color: "text-sky-500",  bg: "bg-sky-500/10" },
  gas_station: { label: "주유소", icon: Fuel,           color: "text-yellow-500", bg: "bg-yellow-500/10" },
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

  if (state.status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { place, cat, setCat, pois, filteredPois, poisLoading, selectedPoiId, selectPoi, handleComplete } = state;

  const selectedPoi = selectedPoiId ? pois.find((p) => p.id === selectedPoiId) ?? null : null;
  const kakaoNavUrl = selectedPoi
    ? `https://map.kakao.com/link/to/${encodeURIComponent(selectedPoi.name)},${selectedPoi.coord.lat},${selectedPoi.coord.lng}`
    : null;

  return (
    <>
      {/* 지도 영역 — 고정 높이 */}
      <div className="relative shrink-0" style={{ height: "45vh" }}>
        {/* 헤더 — 지도 위에 오버레이 */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-4 pb-2 bg-linear-to-b from-background/90 to-transparent">
          <h1 className="text-[18px] font-bold text-text-primary tracking-tight">
            진행 중인 코스
          </h1>
        </div>

        {place.coord ? (
          <CourseMap
            mainPlace={{ name: place.name, coord: place.coord }}
            pois={selectedPoiId ? pois.filter((p) => p.id === selectedPoiId) : []}
            selectedPoiId={selectedPoiId}
            onSelectPoi={selectPoi}
          />
        ) : (
          <CourseMapPlaceholder />
        )}

        {/* POI 선택 시 플로팅 내비게이션 바 */}
        {selectedPoi && kakaoNavUrl && (
          <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-2 bg-background/95 backdrop-blur-sm rounded-xl px-3 py-2.5 shadow-lg border border-border">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-text-primary truncate">{selectedPoi.name}</p>
              <p className="text-[11px] text-text-secondary">{selectedPoi.dist}</p>
            </div>
            <a
              href={kakaoNavUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 bg-primary text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg active:opacity-80"
            >
              <Navigation size={13} strokeWidth={2.5} />
              길 안내
            </a>
          </div>
        )}
      </div>

      {/* 바텀시트 — 세 섹션으로 분리 */}
      <div className="flex-1 overflow-y-auto bg-background rounded-t-3xl -mt-5 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="px-4 pt-4 pb-4 flex flex-col gap-4">
          {/* 섹션 A: 지금 여기 */}
          <div className="rounded-xl bg-card border-l-4 border-primary px-4 py-3.5">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-2">
              지금 여기
            </p>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[17px] font-bold text-text-primary leading-tight">{place.name}</span>
              <Badge variant="secondary">현재</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                {place.cat}
              </span>
              <span className="text-text-secondary/50">·</span>
              <span className="text-xs text-text-secondary">{place.dur} 머무는 중</span>
            </div>
          </div>

          {/* 섹션 B: 주변 */}
          <div>
            <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.04em] mb-2.5">
              주변
            </p>
            <NearbyPanel
              cat={cat}
              setCat={setCat}
              pois={filteredPois}
              loading={poisLoading}
              selectedPoiId={selectedPoiId}
              onSelect={selectPoi}
            />
          </div>
        </div>
      </div>

      {/* CTA 바 */}
      <div className="border-t border-border bg-background px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,8px))]">
        <Button size="cta" className="w-full gap-2" onClick={handleComplete}>
          코스 완료
          <Check size={16} />
        </Button>
      </div>
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
    <div className="pb-3">
      {/* 카테고리 필터 칩 — 우측 페이드로 스크롤 힌트 */}
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
        {/* 우측 페이드 — 더 보여줄 칩이 있음을 암시 */}
        <div className="pointer-events-none absolute right-0 top-0 h-[calc(100%-8px)] w-8 bg-linear-to-l from-card to-transparent" />
      </div>

      {/* 주변 장소 목록 헤더 */}
      <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide mb-2">
        현재 위치 기준
      </p>

      {/* 주변 장소 목록 */}
      {loading && (
        <div className="flex justify-center py-4">
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
                  isSelected
                    ? "bg-primary/8 border-primary/30"
                    : "border-transparent",
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
        <div className="flex flex-col items-center gap-2 py-4 mt-1">
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
