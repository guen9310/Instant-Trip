import { useMemo, useRef, type PointerEvent, type RefObject } from "react";
import { PlaceCard } from "@/components/domains/home/PlaceCard";
import { CHIP_TO_TYPE, FILTER_CHIPS, type FilterChip } from "@/components/domains/home/homeFilters";
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

// 이 거리(px) 이상 가로로 밀어야 스와이프로 인정 — 짧은 흔들림이나 세로
// 스크롤 도중의 미세한 가로 움직임을 실수로 필터 전환시키지 않기 위함.
const SWIPE_THRESHOLD_PX = 60;

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
  const filteredPlaces = useMemo(() => {
    const typeId = CHIP_TO_TYPE[filter];
    return typeId ? places.filter((p) => p.contenttypeid === typeId) : places;
  }, [places, filter]);

  // 캐러셀처럼 다른 칩의 콘텐츠를 미리 그려두지 않는다 — 실제로 보여줄 그리드
  // 하나만 렌더링하고, 제스처는 "충분히 크게 옆으로 밀었는지"만 판정해 칩 클릭과
  // 동일하게 onFilter를 호출한다. 그 결과 다른 칩의 항목 수(특히 "전체"처럼
  // 카테고리를 합산해 훨씬 긴 목록)가 현재 화면 높이에 영향을 주지 않는다.
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;

    const currentIndex = FILTER_CHIPS.indexOf(filter);
    const nextChip = FILTER_CHIPS[currentIndex + (dx < 0 ? 1 : -1)];
    if (nextChip) onFilter(nextChip);
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
  };

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

      {/*
        touch-pan-y — 세로 스크롤은 브라우저 네이티브 제스처로 그대로 두고,
        가로 방향 움직임만 우리 포인터 핸들러가 판정하게 한다.
      */}
      <div
        className="touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {filteredPlaces.length === 0 ? null : (
          <div className="grid grid-cols-2 gap-3">
            {filteredPlaces.map((place) => (
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
      </div>
    </section>
  );
}
