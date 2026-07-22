"use client";

import { useState } from "react";
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
  Navigation,
  EyeOff,
  Eye,
} from "lucide-react";
import { PlaceThumbnail } from "@/components/domains/course/PlaceThumbnail";
import { CourseMap } from "@/components/domains/course/CourseMap";
import { cn, isBlank } from "@/shared/utils";
import { Badge } from "@/components/commons/Badge";
import { Button } from "@/components/commons/Button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/commons/Drawer";
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

type Props = {
  courseId: string;
  // localStorage에 세션이 없을 때(다른 기기·저장소 초기화 등) 쓰는 서버 측 대비책.
  // page.tsx가 미리 조회해둔다 — 자세한 이유는 useCourseActive.ts 참고.
  dbFallback: ResumableCourse | null;
};

export function CourseActiveView({ courseId, dbFallback }: Props) {
  const state = useCourseActive(courseId, dbFallback);
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);

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
            className="flex-1 min-h-0 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom,12px)]"
          >
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
          </div>
        </DrawerContent>
      </Drawer>
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
  // 길찾기 대상 — POI를 선택 중이면 그 장소로, 아니면 현재 장소로.
  // 별도 state/ref 없이 selectedPoiId + pois에서 매 렌더 파생한다(단일 진실 소스 유지).
  const selectedPoi = selectedPoiId ? pois.find((p) => p.id === selectedPoiId) : undefined;
  const directionsName = selectedPoi?.name ?? placeName;

  // 주변 마커 숨기기 — POI가 몰려 있을 때 현재 장소 마커를 완전히 가리고 싶을 때 쓴다.
  // 목록에서 특정 장소를 선택하면(그 하나만 보고 싶다는 의도) 자동으로 해제한다.
  // pois 자체를 비워 넘기지 않는다 — CourseMap의 bounds 계산도 pois를 쓰기 때문에,
  // 그렇게 하면 마커를 껐다 켤 때마다 지도 확대 범위(30m↔250m)까지 같이 튀는 부작용이 생긴다.
  const [poisHidden, setPoisHidden] = useState(false);

  return (
    <div className="pb-4">
      {/* 지도 미리보기 — 현재 장소 + 필터링된 POI 마커, 리스트 탭과 선택 상태를 공유 */}
      {placeCoord && (
        <div className="relative h-72 rounded-xl overflow-hidden border border-border mb-3">
          <CourseMap
            mainPlace={{ name: placeName, coord: placeCoord }}
            pois={pois}
            selectedPoiId={selectedPoiId}
            onSelectPoi={onSelect}
            hideMarkers={poisHidden && !selectedPoiId}
          />
          {/* 주변 마커 토글 — 스크린샷처럼 POI가 몰려 현재 장소가 묻힐 때 전부 끌 수 있게 */}
          {pois.length > 0 && (
            <button
              type="button"
              onClick={() => setPoisHidden((v) => !v)}
              className="absolute z-10 top-3 right-3 flex items-center gap-1.5 px-3 py-2 rounded-full bg-background/95 backdrop-blur-xs border border-border shadow-md text-[12px] font-semibold text-text-secondary active:scale-95 transition-transform"
            >
              {poisHidden ? (
                <>
                  <Eye size={13} strokeWidth={2.2} />
                  모두 보기
                </>
              ) : (
                <>
                  <EyeOff size={13} strokeWidth={2.2} />
                  숨기기
                </>
              )}
            </button>
          )}
          {/* 카카오맵 길찾기 — 현재 위치 → 선택한 장소(없으면 현재 장소)로의 경로를 새 탭에서 연다.
              카카오맵 SDK가 지도 컨테이너 내부에 자체 stacking context를 만들어서
              z-index 지정 없이는 형제 요소가 DOM 순서상 위에 있어도 지도 레이어에 가려진다. */}
          <a
            href={`https://map.kakao.com/link/map/${encodeURIComponent(directionsName)},${(selectedPoi?.coord ?? placeCoord).lat},${(selectedPoi?.coord ?? placeCoord).lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute z-10 bottom-3 right-3 flex items-center gap-1.5 px-3 py-2 rounded-full bg-background/95 backdrop-blur-xs border border-border shadow-md text-[12px] font-semibold text-primary active:scale-95 transition-transform"
          >
            <Navigation size={13} strokeWidth={2.2} />
            길찾기
          </a>
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
