import type { RefObject } from "react";
import { PlaceCard } from "@/components/domains/home/PlaceCard";
import { FILTER_CHIPS, type FilterChip } from "@/components/domains/home/homeFilters";
import type { TourItem } from "@/lib/tour/types";
import { cn } from "@/shared/utils";

type Props = {
  places: TourItem[];
  hasPlaces: boolean;
  regionName?: string | null;
  filter: FilterChip;
  onFilter: (chip: FilterChip) => void;
  filterElevated: boolean;
  filterBarRef: RefObject<HTMLDivElement | null>;
  startingId: string | null;
  onSelectPlace: (place: TourItem) => void;
};

export function PlacesSection({
  places,
  hasPlaces,
  regionName,
  filter,
  onFilter,
  filterElevated,
  filterBarRef,
  startingId,
  onSelectPlace,
}: Props) {
  if (!hasPlaces) return null;

  return (
    <section>
      <h2 className="text-[15px] font-bold text-text-primary tracking-tight mb-3">
        {regionName ? `${regionName}에서 인기예요` : "인기예요"}
      </h2>

      {/*
        필터 칩 — 스크롤 시에도 상단에 고정된다. 평소엔 목록과 같은 배경으로
        자연스럽게 묻어 있다가, 이 래퍼가 실제로 글로벌 헤더에 맞닿아 고정되는
        순간(HomeView의 handleContentScroll이 filterBarRef로 감지)에만 좌우
        여백이 좁아지고 모서리가 둥글어지며 그림자가 붙는 "떠 있는 캡슐" 형태로
        전환되어 고정 영역임을 시각적으로 구분한다. 바깥 래퍼는 항상 top-0에
        딱 붙는 불투명 배경으로 두고(스크롤 클리핑 경계와 겹치는 틈이 없어야
        뒤 콘텐츠가 비쳐 보이지 않는다), 캡슐이 뜰 때만 안쪽에 pt를 줘서
        헤더와의 공간감을 만든다.
      */}
      <div
        ref={filterBarRef}
        className={cn(
          "sticky top-0 z-10 transition-[padding] duration-150 ease-out",
          filterElevated ? "pt-2.5" : "pt-0",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 mb-3 py-2 overflow-x-auto scrollbar-hide",
            "transition-[width,max-width,margin,padding,border-radius,box-shadow] duration-150 ease-out",
            filterElevated
              ? "w-fit max-w-[calc(100%-1.5rem)] mx-auto px-2.5 rounded-xl shadow-[0_10px_24px_rgba(0,0,0,0.16)] bg-background justify-center-safe"
              : "w-full mx-0 px-0 rounded-none shadow-none justify-start",
          )}
        >
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => onFilter(chip)}
              className={cn(
                "shrink-0 inline-flex items-center justify-center px-3.5 h-7 rounded-full text-[12px] font-semibold leading-none transition-colors",
                "ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                filter === chip
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-text-secondary",
              )}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {places.length === 0 ? null : (
        <div className="grid grid-cols-2 gap-3">
          {places.map((place) => (
            <PlaceCard
              key={place.contentid}
              place={place}
              loading={startingId === place.contentid}
              disabled={startingId !== null}
              onClick={() => onSelectPlace(place)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
