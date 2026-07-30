"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useLocationStore } from "@/client/stores/useLocationStore";
import { useStartCourse } from "@/client/hooks/useStartCourse";
import { getHomeDataAction, getHomeDataByRegionAction } from "@/app/actions/home";
import { HomeLocationCard } from "@/components/domains/home/HomeLocationCard";
import { HomeSkeleton } from "@/components/domains/home/HomeSkeleton";
import { FestivalSection } from "@/components/domains/home/FestivalSection";
import { PlacesSection } from "@/components/domains/home/PlacesSection";
import { CHIP_TO_TYPE, type FilterChip } from "@/components/domains/home/homeFilters";
import { LocationDeniedView } from "@/components/domains/location/LocationDeniedView";
import type { HomeData } from "@/lib/home/core";

export function HomeView() {
  const { state, requestPermission } = useLocationStore();
  const [filter, setFilter] = useState<FilterChip>("전체");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const { startingId, selectPlace: handleSelectPlace, selectFestival: handleSelectFestival } =
    useStartCourse(setToastMsg);
  // 인기 장소 필터 바 — sticky로 고정되어 글로벌 헤더에 실제로 맞닿는
  // 순간(스크롤 컨테이너 상단에 도달하는 순간)에만 떠 있는 캡슐 형태로 전환한다
  const [isFilterElevated, setIsFilterElevated] = useState(false);
  const filterBarRef = useRef<HTMLDivElement>(null);

  const handleContentScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const filterTop = filterBarRef.current?.getBoundingClientRect().top;
    if (filterTop === undefined) return;
    const containerTop = e.currentTarget.getBoundingClientRect().top;
    // sticky는 컨테이너 상단(top:0)에서 더 내려가지 못하므로, 두 값이
    // 같아지는 순간이 곧 "헤더에 맞닿아 고정된" 순간이다.
    setIsFilterElevated(filterTop <= containerTop + 1);
  };

  useEffect(() => {
    if (state.status === "idle") requestPermission();
    // 새로고침 직후 복원된(restored) 위치는 지오코딩 재확인이 끝나지 않은 상태이므로
    // 마운트 시점에 다시 한번 위치를 확인해 "geo"로 확정한다.
    else if (state.status === "granted" && state.source === "restored") requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 토스트 자동 소멸 — 별도 닫기 UI 없이 일정 시간 후 사라진다
  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  // "restored"(새로고침 직후 재확인 전 위치)는 확정된 위치가 아니므로 쿼리를 막는다.
  // 이렇게 하지 않으면 지오코딩 재확인 완료 시 좌표/지역명이 바뀌며 쿼리 키가 달라져
  // 홈 데이터가 두 번 호출된다(1차 응답은 폐기됨).
  const locationKey =
    state.status === "granted" && state.source !== "restored"
      ? {
          city: state.city,
          sidoName: state.sidoName ?? null,
          // GPS 좌표는 미세하게 흔들리므로(지터) 소수 4자리(~11m 단위)로 반올림해
          // 쿼리 키를 안정시킨다. 액션 호출 자체는 원본 좌표를 그대로 쓴다.
          lat: state.lat != null ? Math.round(state.lat * 1e4) / 1e4 : null,
          lng: state.lng != null ? Math.round(state.lng * 1e4) / 1e4 : null,
        }
      : null;

  const {
    data: homeData,
    isPending: homePending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["home", locationKey],
    queryFn: async (): Promise<HomeData> => {
      if (state.status !== "granted") throw new Error("no location");
      const { city, sidoName, source, lat, lng } = state;
      if (source === "geo" && lat && lng) {
        return getHomeDataAction({ lat, lng, city, sidoName });
      }
      return getHomeDataByRegionAction({ regionName: sidoName ?? city });
    },
    enabled: state.status === "granted" && state.source !== "restored",
    staleTime: 5 * 60 * 1000,
  });

  const isDenied =
    state.status === "denied" ||
    state.status === "system-denied" ||
    state.status === "timeout" ||
    state.status === "unavailable";

  if (isDenied) {
    return (
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <LocationDeniedView variant="denied" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-[15px] text-text-secondary text-center">
          데이터를 불러오는 데 실패했어요
        </p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold"
        >
          <RefreshCw size={14} />
          다시 시도
        </button>
      </div>
    );
  }

  const festivalError = homeData?.errors?.includes("festivals");
  const placesError = homeData?.errors?.includes("places");
  const allFestivals = [
    ...(homeData?.ongoingFestivals ?? []),
    ...(homeData?.upcomingFestivals ?? []),
  ];
  const typeId = CHIP_TO_TYPE[filter];
  const filteredPlaces = (homeData?.places ?? []).filter((p) =>
    typeId ? p.contenttypeid === typeId : true,
  );
  const showSectionSkeletons =
    state.status !== "granted" || (homePending && !homeData);

  const regionLat = homeData?.region?.lat;
  const regionLng = homeData?.region?.lng;

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide" onScroll={handleContentScroll}>
      {/*
        스크롤 컨테이너 자체에는 세로 패딩을 두지 않는다 — overflow 클리핑은
        패딩 엣지 기준이라, 컨테이너에 pt를 주면 그 패딩 영역 안으로 이전
        섹션이 스크롤되어 비쳐 보이고, 하위의 sticky 필터가 그 틈을 못 덮는다.
        패딩은 아래 내부 래퍼로 옮겨 완전히 스크롤되어 사라지게 한다.
      */}
      <div className="px-4 py-5">
        {/* 1. 위치/날씨 카드 (출발하기 CTA 내장) */}
        <HomeLocationCard regionLat={regionLat} regionLng={regionLng} />

        {showSectionSkeletons ? (
          <HomeSkeleton />
        ) : (
          <>
            {/* 3. 축제 섹션 — 0건이면 렌더 안 함 */}
            {!festivalError && allFestivals.length > 0 && (
              <FestivalSection
                festivals={allFestivals}
                startingId={startingId}
                onSelectFestival={handleSelectFestival}
              />
            )}

            {/* 4. 지역 인기 장소 목록 — 거리순이 아니라 시/도 단위 카테고리별 인기순 top10 */}
            {!placesError && (
              <PlacesSection
                places={filteredPlaces}
                hasPlaces={(homeData?.places ?? []).length > 0}
                regionName={homeData?.region?.name}
                filter={filter}
                onFilter={setFilter}
                filterElevated={isFilterElevated}
                filterBarRef={filterBarRef}
                startingId={startingId}
                onSelectPlace={handleSelectPlace}
              />
            )}
          </>
        )}
      </div>

      {toastMsg && (
        <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom,6px))] left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-foreground text-background text-[13px] font-medium shadow-lg max-w-[calc(100vw-32px)] text-center">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
