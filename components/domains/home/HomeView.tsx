"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, PartyPopper, Trees, Landmark, Bike, MapPin, Loader2 } from "lucide-react";
import type { ElementType } from "react";
import { useLocationStore } from "@/client/stores/useLocationStore";
import { useCourseProgressStore } from "@/client/stores/useCourseProgressStore";
import { getHomeDataAction, getHomeDataByRegionAction } from "@/app/actions/home";
import { generateCourseFromPlaceAction } from "@/app/actions/course";
import { HomeLocationCard } from "@/components/domains/home/HomeLocationCard";
import { LocationDeniedView } from "@/components/domains/location/LocationDeniedView";
import { ImagePlaceholder } from "@/components/commons/ImagePlaceholder";
import type { HomeData } from "@/lib/home/core";
import type { FestivalSummary, PendingCourse } from "@/shared/types/course.types";
import type { TourItem } from "@/lib/tour/types";
import { cn, isBlank } from "@/shared/utils";

// 콘텐츠 타입 → 표시 라벨
const TYPE_LABEL: Record<string, string> = {
  "12": "관광지",
  "14": "문화시설",
  "28": "레포츠",
};

const TYPE_ICON: Record<string, ElementType> = {
  "12": Trees,
  "14": Landmark,
  "28": Bike,
};
const FILTER_CHIPS = ["전체", "관광지", "문화시설", "레포츠"] as const;
type FilterChip = (typeof FILTER_CHIPS)[number];
const CHIP_TO_TYPE: Partial<Record<FilterChip, string>> = {
  관광지: "12",
  문화시설: "14",
  레포츠: "28",
};

export function HomeView() {
  const router = useRouter();
  const { state, requestPermission } = useLocationStore();
  const [filter, setFilter] = useState<FilterChip>("전체");
  const [startingId, setStartingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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

  // 홈 근처 장소 카드 탭 → 시트 없이 바로 코스 생성 후 프리뷰로 이동
  const handleSelectPlace = async (place: TourItem) => {
    if (startingId) return;
    setStartingId(place.contentid);

    const lat = parseFloat(place.mapy);
    const lng = parseFloat(place.mapx);

    const result = await generateCourseFromPlaceAction({
      contentId: place.contentid,
      contentTypeId: place.contenttypeid,
      lat,
      lng,
    });

    if (!result.ok) {
      setStartingId(null);
      setToastMsg(
        result.code === "NOT_FOUND"
          ? "장소 정보를 찾을 수 없어요. 다른 장소를 선택해주세요."
          : "갈 곳을 찾는 중 문제가 생겼어요. 다시 시도해주세요.",
      );
      return;
    }

    // 새 코스 생성 — 이전 코스에서 쌓인 리롤 소진/거절 이력은 여기서 끊는다.
    // 리롤(같은 코스 내 재추천)에서는 이 경로를 타지 않으므로 rejectedPlaceIds가 유지된다.
    useCourseProgressStore.getState().resetRerolls();

    const pending: PendingCourse = {
      courseId: result.courseId,
      place: result.place,
      courseName: result.courseName,
      festivals: result.festivals,
      mapX: lng,
      mapY: lat,
      availability: result.availability,
      generatedAt: Date.now(),
    };
    localStorage.setItem("pendingCourse", JSON.stringify(pending));
    router.push("/course/preview");
  };

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
              startingId={startingId}
              onSelectPlace={handleSelectPlace}
            />
          )}
        </>
      )}

      {toastMsg && (
        <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom,6px))] left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-foreground text-background text-[13px] font-medium shadow-lg max-w-[calc(100vw-32px)] text-center">
          {toastMsg}
        </div>
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
            {!isBlank(f.imageUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={f.imageUrl!}
                alt={f.name}
                className="w-full aspect-video object-cover"
              />
            ) : (
              <ImagePlaceholder icon={PartyPopper} className="w-full aspect-video" />
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
  startingId,
  onSelectPlace,
}: {
  places: TourItem[];
  hasPlaces: boolean;
  filter: FilterChip;
  onFilter: (chip: FilterChip) => void;
  startingId: string | null;
  onSelectPlace: (place: TourItem) => void;
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

function PlaceCard({
  place,
  loading,
  disabled,
  onClick,
}: {
  place: TourItem;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const typeLabel = TYPE_LABEL[place.contenttypeid] ?? "";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative w-full text-left rounded-xl overflow-hidden border border-border bg-card active:scale-[0.98] transition-transform duration-150",
        disabled && !loading && "opacity-40",
      )}
    >
      {!isBlank(place.firstimage) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={place.firstimage}
          alt={place.title}
          className="w-full aspect-video object-cover"
        />
      ) : (
        <ImagePlaceholder
          icon={TYPE_ICON[place.contenttypeid] ?? MapPin}
          className="w-full aspect-video"
        />
      )}
      <div className="px-2.5 py-2">
        <p className="text-[13px] font-semibold text-text-primary leading-snug line-clamp-2">
          {place.title}
        </p>
        {typeLabel && (
          <p className="text-[11px] text-text-secondary mt-0.5">{typeLabel}</p>
        )}
      </div>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80">
          <Loader2 size={20} className="animate-spin text-primary" />
        </div>
      )}
    </button>
  );
}
