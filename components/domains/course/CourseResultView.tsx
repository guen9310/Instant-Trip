"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Settings2,
  Clock,
  Calendar,
  ChevronRight,
  AlertCircle,
  MapPin,
  ThumbsDown,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { Badge } from "@/components/commons/Badge";
import { Button } from "@/components/commons/Button";
import { FestivalDetailSheet } from "@/components/domains/course/FestivalDetailSheet";
import {
  useCourseProgressStore,
  MAX_REROLLS,
} from "@/client/stores/useCourseProgressStore";
import { generateCourseAction } from "@/app/actions/course";
import { startCourseAction } from "@/app/actions/completion";
import type {
  JourneyPlace,
  FestivalSummary,
  PendingCourse,
  PlaceAvailabilitySnapshot,
} from "@/shared/types/course.types";
import type { Prefs } from "@/shared/constants/preferences";
import { PlaceThumbnail } from "@/components/domains/course/PlaceThumbnail";
import { NearbyRestaurants } from "@/components/domains/course/NearbyRestaurants";
import { CourseMap } from "@/components/domains/course/CourseMap";

const TRAVEL_REASON: Record<string, string> = {
  walk: "걷는 게 좋아요",
  min: "이동 최소화",
};

const REJECT_REASONS = [
  { id: "far", icon: MapPin, label: "너무 멀어요" },
  { id: "taste", icon: ThumbsDown, label: "취향이 아니에요" },
  { id: "visited", icon: Calendar, label: "이미 가봤어요" },
  { id: "time", icon: Clock, label: "시간이 안 맞아요" },
] as const;

type Props = {
  courseId: string;
  courseName: string;
  place: JourneyPlace;
  festivals?: FestivalSummary[];
  isLoading?: boolean;
  mapX?: number;
  mapY?: number;
  scale?: string;
  region?: string;
  // 생성 시점 취향 스냅샷 (PendingCourse.prefs) — 칩·맛집 섹션·재추천이 읽는다.
  // 구버전 localStorage 페이로드엔 없을 수 있어 optional: 없으면 취향 표시를 숨긴다.
  prefs?: Prefs;
  // 선택 진입(place.origin==="selected")에서만 채워진다 — 운영시간 경고 배너에 사용.
  availability?: PlaceAvailabilitySnapshot;
  // 코스 생성 시점(epoch ms) — 운영시간 배지가 참조하는 판정은 이 시점의 스냅샷이라
  // 오래되면(30분 초과) 배지를 숨기는 데 쓴다. 구버전 localStorage 페이로드엔 없을 수 있다.
  generatedAt?: number;
  // 서버 컴포넌트(page.tsx)에서 getSession()으로 미리 판정 — 탭 시 서버 왕복 없이
  // 즉시 분기하기 위함 (비로그인은 안내 후 이동, 로그인은 낙관적 이동).
  isAuthenticated: boolean;
};

// 운영시간 배지 스냅샷 유효 시간 — 이보다 오래된 generatedAt은 배지를 숨긴다.
// 판정 자체는 코스 생성 시점의 실시간 계산이라 그 이후 시간이 흐르면 더 이상 유효하지 않다.
const BADGE_SNAPSHOT_MAX_AGE_MS = 30 * 60 * 1000;

export function CourseResultView({
  courseId,
  courseName,
  place,
  festivals = [],
  isLoading = false,
  mapX,
  mapY,
  scale,
  region,
  prefs,
  availability,
  generatedAt,
  isAuthenticated,
}: Props) {
  const [selectedFestival, setSelectedFestival] =
    useState<FestivalSummary | null>(null);
  const [rerolling, setRerolling] = useState(false);
  const [currentCourseId, setCurrentCourseId] = useState(courseId);
  const [currentPlace, setCurrentPlace] = useState<JourneyPlace>(place);
  const [currentCourseName, setCurrentCourseName] = useState(courseName);
  const [currentFestivals, setCurrentFestivals] = useState(festivals);
  const [currentGeneratedAt, setCurrentGeneratedAt] = useState(generatedAt);
  // 최초 진입 시점(마운트) 기준 1회만 판단한다 — 리롤 시엔 doReroll이 방금 생성된
  // 신선한 스냅샷임을 알고 있으므로 같은 핸들러에서 false로 직접 갱신한다
  // (effect로 다른 state 변화에 반응해 setState하는 캐스케이드 패턴을 피한다).
  const [isBadgeSnapshotStale, setIsBadgeSnapshotStale] = useState(
    () =>
      !currentGeneratedAt ||
      Date.now() - currentGeneratedAt > BADGE_SNAPSHOT_MAX_AGE_MS,
  );
  const [rerollExhausted, setRerollExhausted] = useState(false);
  const [newPlaceId, setNewPlaceId] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState(false);
  const [rejectPanelOpen, setRejectPanelOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState<string | null>(null);

  const router = useRouter();
  const startCourse = useCourseProgressStore((s) => s.start);
  const { rejectedPlaceIds, rerollCount, addRejection } =
    useCourseProgressStore();

  const isMaxRerolls = rerollCount >= MAX_REROLLS;

  const doReroll = async (excludeIds: string[]) => {
    // prefs 없음 = 구버전 localStorage 페이로드 — 생성 시점 취향을 모르니 재추천 불가
    if (!mapX || !mapY || !scale || !prefs) return;
    setRerolling(true);
    setRerollExhausted(false);

    const prevId = currentPlace.id;

    const result = await generateCourseAction({
      mapX,
      mapY,
      scale: scale as "light" | "moderate" | "leisurely",
      prefs,
      excludeIds,
    });

    setRerolling(false);

    if (!result.ok) {
      setRerollExhausted(true);
      return;
    }

    setCurrentCourseId(result.courseId);
    setCurrentPlace(result.place);
    setCurrentCourseName(result.courseName);
    setCurrentFestivals(result.festivals);
    console.log(
      `[festival] 재추천 후 수신 — ${result.festivals.length}건`,
      result.festivals,
    );

    if (result.place.id !== prevId) {
      setNewPlaceId(result.place.id);
      setTimeout(() => setNewPlaceId(null), 3000);
    }

    const generatedAt = Date.now();
    setCurrentGeneratedAt(generatedAt);
    setIsBadgeSnapshotStale(false); // 방금 생성한 신선한 스냅샷

    const pending: PendingCourse = {
      courseId: result.courseId,
      place: result.place,
      courseName: result.courseName,
      festivals: result.festivals,
      mapX,
      mapY,
      scale,
      region,
      prefs,
      generatedAt,
    };
    localStorage.setItem("pendingCourse", JSON.stringify(pending));
  };

  const handleReject = async (
    placeId: string,
    reason: string,
  ): Promise<void> => {
    console.log(`[reroll] 거절 — placeId: ${placeId}, reason: ${reason}`);
    addRejection(placeId);
    await doReroll([...rejectedPlaceIds, placeId]);
  };

  // 거절 이유 확정 — 원래 PlaceDetailSheet(드로어)의 "여기 말고 다른 곳으로"와 동일하게,
  // 리롤 성공/실패 여부와 무관하게 완료 후 패널을 닫는다(실패 시엔 rerollExhausted 배너가 안내).
  const handleConfirmReject = async () => {
    if (!rejectReason) return;
    await handleReject(currentPlace.id, rejectReason);
    setRejectPanelOpen(false);
    setRejectReason(null);
  };

  // 비로그인 안내 후 로그인 화면으로 이동 — HomeView의 토스트 자동 소멸 패턴과 동일하게
  // 일정 시간 노출 후 전환한다(안내를 보여줄 틈 없이 즉시 이동하지 않도록).
  useEffect(() => {
    if (!authNotice) return;
    const timer = setTimeout(() => router.push("/sign-in"), 1500);
    return () => clearTimeout(timer);
  }, [authNotice, router]);

  // 로그인 여부는 page.tsx가 렌더 시점에 이미 서버에서 확인해뒀다 — 여기서는
  // 그 결과에 따라 분기만 한다 (서버 왕복을 기다리지 않기 위함).
  const handleStart = () => {
    if (!isAuthenticated) {
      setAuthNotice(true);
      return;
    }

    // 낙관적 이동 — startCourseAction 완료를 기다리지 않고 즉시 진행 화면으로 전환한다.
    startCourse(currentCourseId);
    router.push(`/course/active/${currentCourseId}`);

    void startCourseAction({
      courseName: currentCourseName,
      scale: scale ?? "moderate",
      region,
      place: currentPlace,
    }).then((result) => {
      // 세션 만료 등 엣지 — 이미 이동한 뒤라 되돌리진 않되 기존 안내 처리는 유지한다.
      if (!result.ok) {
        if (result.reason === "unauthenticated") setAuthNotice(true);
        return;
      }

      // 완료 시 completionId·dbCourseId를 localStorage에 기록해두면
      // CourseDoneView가 INSERT 대신 UPDATE를 사용할 수 있다.
      try {
        const raw = localStorage.getItem("pendingCourse");
        if (!raw) return;
        const pending = JSON.parse(raw) as PendingCourse;
        localStorage.setItem(
          "pendingCourse",
          JSON.stringify({
            ...pending,
            completionId: result.completionId,
            dbCourseId: result.dbCourseId,
          }),
        );
      } catch {}
    });
  };

  if (isLoading) {
    return <CourseResultSkeleton />;
  }

  // 상태 배지 3분기 — 선택 진입(직접 고른 장소)은 실측 운영 여부(availability.isOpenNow)로,
  // 추천 진입은 파싱 성공 여부(availabilityUncertain)로 판정한다. 판단 불가하면 배지 자체를 숨긴다.
  const availabilityBadge: { text: string; variant: "accent" | "point" } | null =
    isBadgeSnapshotStale
      ? null
      : currentPlace.origin === "selected"
        ? availability?.isOpenNow === false
          ? { text: "운영시간 확인 필요", variant: "point" }
          : availability?.isOpenNow === true
            ? { text: "지금 출발 가능", variant: "accent" }
            : null
        : currentPlace.availabilityUncertain
          ? null
          : { text: "지금 출발 가능", variant: "accent" };

  // 장소 좌표 — 지도 미리보기·근처 맛집 검색이 공유한다.
  // currentPlace.coord가 없는 구버전 페이로드는 검색 원점(mapX=경도, mapY=위도)으로 대체한다.
  const placeCoord =
    currentPlace.coord ?? (mapX && mapY ? { lat: mapY, lng: mapX } : null);

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-2">
        {/* 헤더 — 장소명 + 상태 배지 */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight flex-1 min-w-0">
            {currentCourseName}
          </h1>
          {availabilityBadge && (
            <Badge variant={availabilityBadge.variant} className="shrink-0 mt-0.5">
              {availabilityBadge.variant === "accent" ? (
                <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block mr-1" />
              ) : (
                <AlertCircle size={11} className="inline-block mr-1" />
              )}
              {availabilityBadge.text}
            </Badge>
          )}
        </div>
        {prefs && (
          <div className="inline-flex self-start items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/8 text-primary text-[12px] font-medium mb-5">
            {`'${TRAVEL_REASON[prefs.travel] ?? prefs.travel}' 취향에 맞게 골랐어요`}
          </div>
        )}

        {/* 후보 소진 안내 */}
        {rerollExhausted && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-point/8 border border-point/20 mb-4">
            <AlertCircle size={16} className="text-point shrink-0 mt-0.5" />
            <p className="text-[13px] text-point leading-snug">
              이 근처에서 더 추천할 곳이 없어요. 반경을 넓혀보거나 위치를
              옮겨보세요.
            </p>
          </div>
        )}

        {/* 대표 이미지 — 이미지 없으면 슬롯 자체를 렌더하지 않는다 */}
        {currentPlace.imageUrl && (
          <div className="w-full h-44 rounded-xl overflow-hidden mb-3">
            <PlaceThumbnail
              imageUrl={currentPlace.imageUrl}
              cat={currentPlace.cat}
              className="w-full h-full"
              sizes="100vw"
            />
          </div>
        )}

        {/* 카테고리·태그 칩 행 */}
        <div className="w-full flex items-center gap-1.5 flex-wrap mb-3">
          <span className="text-[11px] font-semibold text-text-secondary">
            {currentPlace.cat}
          </span>
          {(currentPlace.tags.length > 0
            ? currentPlace.tags.slice(0, 2)
            : [currentPlace.badge.text]
          ).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded-full bg-primary/8 text-primary text-[10px] font-semibold"
            >
              {tag}
            </span>
          ))}
          {currentPlace.id === newPlaceId && (
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
              새 장소
            </span>
          )}
        </div>

        {/* 정보 행 — 주소 / 영업시간 / 예상 체류 (드로어를 열지 않아도 바로 판단) */}
        {(currentPlace.addr || currentPlace.hours?.trim() || currentPlace.dur) && (
          <div className="flex flex-col gap-2.5">
            {currentPlace.addr && (
              <div className="flex items-center gap-2.5">
                <MapPin size={16} className="text-text-secondary shrink-0" />
                <span className="text-[14px] text-text-primary">
                  {currentPlace.addr}
                </span>
              </div>
            )}
            {currentPlace.hours?.trim() && (
              <div className="flex items-start gap-2.5">
                <Clock size={16} className="text-text-secondary shrink-0 mt-0.5" />
                <div className="text-[14px] text-text-primary">
                  {currentPlace.hours.split("\n").map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>
            )}
            {currentPlace.dur && (
              <div className="flex items-center gap-2.5">
                <Calendar size={16} className="text-text-secondary shrink-0" />
                <span className="text-[14px] text-text-primary">
                  {currentPlace.dur}
                  <span className="ml-1.5 text-[11px] text-text-secondary">
                    카테고리 평균 기준
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* 영업시간 안내 링크 — 파싱 실패 장소에만 노출 */}
        {currentPlace.availabilityUncertain && currentPlace.name?.trim() && (
          <HoursInfoCard placeName={currentPlace.name} />
        )}

        {/* 소개 — 2줄 클램프 + 더보기/접기 토글 */}
        {currentPlace.desc?.trim() && (
          <PlaceDescription key={currentPlace.id} desc={currentPlace.desc} />
        )}

        {/* 장소 지도 미리보기 — 마커 1개, 인터랙션은 SDK 기본값 */}
        {placeCoord && (
          <div className="mt-3 h-45 rounded-xl overflow-hidden border border-border">
            <CourseMap mainPlace={{ name: currentPlace.name, coord: placeCoord }} />
          </div>
        )}

        {/* 보조 정보 — 근처 맛집 / 진행중 축제 (단일 장소 추천을 흐리지 않는 보조 수준) */}
        {(prefs?.food === "matjip" || currentFestivals.length > 0) && (
          <div className="mt-3 flex flex-col gap-2.5">
            {prefs?.food === "matjip" && placeCoord && (
              <NearbyRestaurants
                placeName={currentPlace.name}
                addr={currentPlace.addr}
                coord={placeCoord}
              />
            )}

            {/* 주변 축제 섹션 — 렌더만 비활성화 (조회 로직은 그대로 유지, 복원 가능)
            {currentFestivals.length > 0 && (
              <div className="p-3.5 rounded-xl bg-card border border-border">
                <p className="flex items-center gap-1.5 text-xs text-text-secondary mb-2.5">
                  <PartyPopper size={14} /> 주변 축제
                </p>
                <div className="flex flex-col gap-2.5">
                  {currentFestivals.slice(0, 3).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFestival(f)}
                      className="w-full flex items-center justify-between gap-2 text-left active:scale-[0.98] transition-transform duration-150"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-text-primary truncate">
                          {f.name}
                        </p>
                        <p className="text-[11px] text-text-secondary">
                          {f.period}
                        </p>
                      </div>
                      <Badge
                        variant={f.status === "ongoing" ? "accent" : "outline"}
                      >
                        {f.status === "ongoing" ? "진행중" : "예정"}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}
            */}
          </div>
        )}
      </div>

      {/* CTA 바 */}
      <div className="border-t border-border bg-background px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,8px))] flex flex-col gap-2">
        {rejectPanelOpen ? (
          rerolling ? (
            <div className="flex flex-col items-center justify-center gap-3 py-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-[14px] text-text-secondary">새로운 장소를 찾는 중...</p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground text-center">
                거절한 장소는 다음 추천에서 제외돼요
              </p>
              <div className="grid grid-cols-2 gap-2">
                {REJECT_REASONS.map((r) => {
                  const sel = rejectReason === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setRejectReason(r.id)}
                      className={cn(
                        "p-3.5 rounded-[10px] border flex flex-col items-center gap-2 transition-colors",
                        sel
                          ? "bg-primary/5 border-primary text-primary"
                          : "bg-background border-border text-text-secondary",
                      )}
                    >
                      <r.icon size={20} />
                      <span className="text-[13px] font-medium">{r.label}</span>
                    </button>
                  );
                })}
              </div>
              <Button size="cta" disabled={!rejectReason} onClick={handleConfirmReject}>
                여기 말고 다른 곳으로
              </Button>
              <button
                onClick={() => {
                  setRejectPanelOpen(false);
                  setRejectReason(null);
                }}
                className="w-full h-10 text-[13px] font-medium text-text-secondary"
              >
                취소
              </button>
            </>
          )
        ) : (
          <>
            <Button size="cta" className="w-full" onClick={handleStart}>
              여기로 갈게요
            </Button>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => router.push("/start")}
                className="h-12 text-[15px] font-medium text-text-secondary flex items-center justify-center gap-1.5"
              >
                <Settings2 size={15} /> 취향 다시 설정
              </button>
              {currentPlace.origin !== "selected" && (
                <button
                  onClick={() => setRejectPanelOpen(true)}
                  disabled={isMaxRerolls || rerolling}
                  className={cn(
                    "h-12 text-[15px] font-medium text-point flex items-center justify-center gap-1.5",
                    (isMaxRerolls || rerolling) && "opacity-40 cursor-not-allowed",
                  )}
                >
                  <ThumbsDown size={15} /> 이런 곳은 싫어요
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <FestivalDetailSheet
        festival={selectedFestival}
        onClose={() => setSelectedFestival(null)}
      />

      {authNotice && (
        <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom,6px))] left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-foreground text-background text-[13px] font-medium shadow-lg max-w-[calc(100vw-32px)] text-center">
          로그인하면 외출을 시작하고 기록할 수 있어요
        </div>
      )}
    </>
  );
}

function HoursInfoCard({ placeName }: { placeName: string }) {
  return (
    <a
      href={`https://www.google.com/search?q=${encodeURIComponent(`${placeName} 운영시간`)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 flex items-center gap-3.5 py-3.5 px-4 rounded-xl bg-card active:scale-[0.98] transition-transform duration-200"
    >
      <div className="w-9.5 h-9.5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Clock size={18} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-text-secondary leading-none mb-0.5">
          영업시간 정보
        </p>
        <p className="text-[14px] font-semibold text-text-primary leading-snug">
          방문 전 영업시간을 확인해보세요
        </p>
      </div>
      <ChevronRight size={16} className="text-text-secondary shrink-0" />
    </a>
  );
}

// 소개 2줄 클램프 + 더보기/접기 — key={place.id}로 장소가 바뀔 때마다 새로 마운트되어
// expanded/hasMore 상태가 항상 새 장소 기준으로 초기화된다(PlaceDetailSheet가 쓰던 방식과 동일).
function PlaceDescription({ desc }: { desc: string }) {
  const [expanded, setExpanded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) setHasMore(el.scrollHeight > el.clientHeight);
  }, []);

  return (
    <div className="mt-3 flex flex-col gap-1">
      <p
        ref={ref}
        className={cn(
          "text-[14px] text-text-primary leading-[1.55]",
          !expanded && "line-clamp-2",
        )}
      >
        {desc}
      </p>
      {hasMore && (
        <div className="flex justify-end">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-primary text-xs font-semibold hover:underline"
          >
            {expanded ? "접기" : "더보기"}
          </button>
        </div>
      )}
    </div>
  );
}

function CourseResultSkeleton() {
  return (
    <div className="flex-1 px-4 pt-5 pb-4 animate-pulse">
      <div className="h-7 w-48 rounded-lg bg-muted mb-2" />
      <div className="h-4 w-32 rounded bg-muted mb-5" />
      <div className="h-20 rounded-xl bg-muted" />
      <div className="mt-6 h-16 rounded-xl bg-muted" />
    </div>
  );
}
