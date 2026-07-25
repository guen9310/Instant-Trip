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
  Check,
  MapPin,
  Clock,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { PlaceThumbnail } from "@/components/domains/course/PlaceThumbnail";
import { CourseMap } from "@/components/domains/course/CourseMap";
import { cn, isBlank } from "@/shared/utils";
import { Badge } from "@/components/commons/Badge";
import { Button } from "@/components/commons/Button";
import { useCourseActive } from "@/client/hooks/useCourseActive";
import type { NearbyCategory, NearbyPoi, ResumableCourse } from "@/shared/types/course.types";

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

type Props = {
  courseId: string;
  // localStorage에 세션이 없을 때(다른 기기·저장소 초기화 등) 쓰는 서버 측 대비책.
  // page.tsx가 미리 조회해둔다 — 자세한 이유는 useCourseActive.ts 참고.
  dbFallback: ResumableCourse | null;
};

export function CourseActiveView({ courseId, dbFallback }: Props) {
  const state = useCourseActive(courseId, dbFallback);
  const [descOpen, setDescOpen] = useState(false);
  const [nearbyExpanded, setNearbyExpanded] = useState(true);

  if (state.status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { place, placeCoord, cat, setCat, filteredPois, poisLoading, selectedPoiId, selectPoi, handleComplete } = state;

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {/* 장소 이미지 */}
        <div className="relative h-52 bg-card overflow-hidden shrink-0">
          <PlaceThumbnail
            imageUrl={place.imageUrl}
            cat={place.cat}
            className="w-full h-full"
            sizes="(max-width: 430px) 100vw, 430px"
          />
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
          {!isBlank(place.desc) && (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setDescOpen((v) => !v)}
                className="self-start text-primary text-[12px] font-semibold hover:underline"
              >
                {descOpen ? "설명 접기" : "설명 보기"}
              </button>
              {descOpen && (
                <p className="text-[14px] text-text-secondary leading-relaxed">{place.desc}</p>
              )}
            </div>
          )}

          {/* 체류 시간 카드 */}
          <div className="flex items-center gap-3 rounded-xl bg-card border border-border px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Clock size={15} strokeWidth={2} className="text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide mb-0.5">
                예상 체류
              </p>
              <p className="text-[15px] font-bold text-text-primary">{place.dur}</p>
              <p className="text-[11px] text-text-secondary mt-0.5">
                카테고리 평균 기준
              </p>
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

        {/* 주변 정보 — 예전엔 드로어를 열어야 보였지만, 여는 동작 자체가 불필요한
            액션이라 페이지에 바로 병합했다. POI는 드로어 여부와 무관하게 이미
            fetch돼 있어 기본값을 펼침으로 둬도 추가 대기 시간은 없다. 다만 내용이
            길어 화면을 많이 차지할 수 있어 접어둘 수 있게는 남겨뒀다. */}
        <div className="px-4 pt-4 pb-2 border-t border-border mt-2">
          <button
            type="button"
            onClick={() => setNearbyExpanded((v) => !v)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h2 className="text-[15px] font-bold text-text-primary">
              주변 정보
            </h2>
            <ChevronDown
              size={16}
              strokeWidth={2.2}
              className={cn(
                "text-text-secondary transition-transform",
                nearbyExpanded && "rotate-180",
              )}
            />
          </button>
          {nearbyExpanded && (
            <NearbyPanel
              placeName={place.name}
              placeCoord={placeCoord}
              cat={cat}
              setCat={setCat}
              pois={filteredPois}
              loading={poisLoading}
              selectedPoiId={selectedPoiId}
              onSelect={selectPoi}
            />
          )}
        </div>
      </div>

      {/* CTA 바 */}
      <div className="border-t border-border bg-background px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,8px))] shrink-0">
        <Button size="cta" className="w-full gap-2" onClick={handleComplete}>
          방문 완료
          <Check size={16} />
        </Button>
      </div>
    </>
  );
}

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

function NearbyPanel({
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
