"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useLocationStore } from "@/client/stores/useLocationStore";
import { getHomeDataAction, getHomeDataByRegionAction } from "@/app/actions/home";
import { HomeLocationCard } from "@/components/domains/home/HomeLocationCard";
import { LocationDeniedView } from "@/components/domains/location/LocationDeniedView";
import type { HomeData } from "@/lib/home/core";
import type { FestivalSummary } from "@/shared/types/course.types";
import type { TourItem } from "@/lib/tour/types";
import { cn } from "@/shared/utils";

// 콘텐츠 타입 → 표시 라벨
const TYPE_LABEL: Record<string, string> = {
  "12": "관광지",
  "14": "문화시설",
  "28": "레포츠",
};
const FILTER_CHIPS = ["전체", "관광지", "문화시설", "레포츠"] as const;
type FilterChip = (typeof FILTER_CHIPS)[number];
const CHIP_TO_TYPE: Partial<Record<FilterChip, string>> = {
  관광지: "12",
  문화시설: "14",
  레포츠: "28",
};

export function HomeView() {
  const { state, requestPermission } = useLocationStore();
  const [filter, setFilter] = useState<FilterChip>("전체");

  useEffect(() => {
    if (state.status === "idle") requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locationKey =
    state.status === "granted"
      ? {
          city: state.city,
          sidoName: state.sidoName ?? null,
          lat: state.lat ?? null,
          lng: state.lng ?? null,
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
    enabled: state.status === "granted",
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
    <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-5">
      {/* 1. 위치/날씨 카드 (출발하기 CTA 내장) */}
      <HomeLocationCard regionLat={regionLat} regionLng={regionLng} />

      {showSectionSkeletons ? (
        <HomeSkeleton />
      ) : (
        <>
          {/* 3. 축제 섹션 — 0건이면 렌더 안 함 */}
          {!festivalError && allFestivals.length > 0 && (
            <FestivalSection festivals={allFestivals} />
          )}

          {/* 4. 근처 장소 목록 */}
          {!placesError && (
            <PlacesSection
              places={filteredPlaces}
              hasPlaces={(homeData?.places ?? []).length > 0}
              filter={filter}
              onFilter={setFilter}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────── 스켈레톤 ─────────────────────────── */

function HomeSkeleton() {
  return (
    <>
      {/* 축제 스켈레톤 */}
      <div className="mb-6">
        <div className="h-5 w-24 rounded bg-muted animate-pulse mb-3" />
        <div className="flex gap-3 overflow-hidden">
          {[0, 1].map((i) => (
            <div key={i} className="flex-shrink-0 w-52 rounded-xl bg-muted animate-pulse aspect-[3/4]" />
          ))}
        </div>
      </div>
      {/* 장소 스켈레톤 */}
      <div>
        <div className="h-5 w-24 rounded bg-muted animate-pulse mb-3" />
        <div className="flex gap-2 mb-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-7 w-14 rounded-full bg-muted animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-muted animate-pulse aspect-[4/5]" />
          ))}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────── 축제 섹션 ─────────────────────────── */

function FestivalSection({ festivals }: { festivals: FestivalSummary[] }) {
  return (
    <section className="mb-6">
      <h2 className="text-[15px] font-bold text-text-primary tracking-tight mb-3">
        주변 축제
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {festivals.map((f) => (
          <div
            key={f.id}
            className="flex-shrink-0 w-48 rounded-xl overflow-hidden border border-border bg-card"
          >
            {f.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={f.imageUrl}
                alt={f.name}
                className="w-full aspect-video object-cover"
              />
            ) : (
              <div className="w-full aspect-video bg-muted" />
            )}
            <div className="px-3 pt-2 pb-3">
              <div className="mb-1.5">
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                    f.status === "ongoing"
                      ? "bg-accent/15 text-accent"
                      : "bg-secondary/15 text-secondary",
                  )}
                >
                  {f.status === "ongoing" ? "진행중" : "예정"}
                </span>
              </div>
              <p className="text-[13px] font-semibold text-text-primary leading-snug line-clamp-2">
                {f.name}
              </p>
              <p className="text-[11px] text-text-secondary mt-1">{f.period}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────── 장소 섹션 ─────────────────────────── */

function PlacesSection({
  places,
  hasPlaces,
  filter,
  onFilter,
}: {
  places: TourItem[];
  hasPlaces: boolean;
  filter: FilterChip;
  onFilter: (chip: FilterChip) => void;
}) {
  if (!hasPlaces) return null;

  return (
    <section>
      <h2 className="text-[15px] font-bold text-text-primary tracking-tight mb-3">
        근처 장소
      </h2>

      {/* 필터 칩 */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => onFilter(chip)}
            className={cn(
              "flex-shrink-0 px-3.5 h-7 rounded-full text-[12px] font-semibold transition-colors",
              filter === chip
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-text-secondary",
            )}
          >
            {chip}
          </button>
        ))}
      </div>

      {places.length === 0 ? null : (
        <div className="grid grid-cols-2 gap-3">
          {places.map((place) => (
            <PlaceCard key={place.contentid} place={place} />
          ))}
        </div>
      )}
    </section>
  );
}

function PlaceCard({ place }: { place: TourItem }) {
  const typeLabel = TYPE_LABEL[place.contenttypeid] ?? "";

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card">
      {place.firstimage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={place.firstimage}
          alt={place.title}
          className="w-full aspect-video object-cover"
        />
      ) : (
        <div className="w-full aspect-video bg-muted" />
      )}
      <div className="px-2.5 py-2">
        <p className="text-[13px] font-semibold text-text-primary leading-snug line-clamp-2">
          {place.title}
        </p>
        {typeLabel && (
          <p className="text-[11px] text-text-secondary mt-0.5">{typeLabel}</p>
        )}
      </div>
    </div>
  );
}
