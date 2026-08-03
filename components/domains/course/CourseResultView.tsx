"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Settings2,
  Clock,
  Calendar,
  AlertCircle,
  MapPin,
  ThumbsDown,
  Navigation,
  Globe,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { Badge } from "@/components/commons/Badge";
import { Button } from "@/components/commons/Button";
import { Dialog, DialogContent, DialogTitle } from "@/components/commons/Dialog";
import { useCourseProgressStore } from "@/client/stores/useCourseProgressStore";
import { useCourseResult } from "@/client/hooks/useCourseResult";
import { redirectToSignIn } from "@/client/redirectToSignIn";
import { startCourseAction } from "@/app/actions/completion";
import type {
  JourneyPlace,
  PendingCourse,
  PlaceAvailabilitySnapshot,
  CourseProgress,
} from "@/shared/types/course.types";
import type { Prefs } from "@/shared/constants/preferences";
import { PlaceThumbnail } from "@/components/domains/course/PlaceThumbnail";
import { NearbyRestaurants } from "@/components/domains/course/NearbyRestaurants";
import { CourseMap } from "@/components/domains/course/CourseMap";
import { HoursInfoCard } from "@/components/domains/course/HoursInfoCard";
import { PlaceDescription } from "@/components/domains/course/PlaceDescription";
import { CourseResultSkeleton } from "@/components/domains/course/CourseResultSkeleton";

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
  isLoading?: boolean;
  mapX?: number;
  mapY?: number;
  scale?: string;
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
  // page.tsx가 getActiveCourse()로 미리 조회해둔, 이미 진행 중인 외출(있다면).
  // "여기로 갈게요" 탭 시 이 값이 있으면 곧바로 시작하지 않고 먼저 확인을 받는다 —
  // 새 외출을 시작하면 서버가 기존 active 기록을 abandoned로 종료하기 때문
  // (startCourseAction 참고). 이 화면은 그 사실을 사용자에게 미리 알리는 역할만 한다.
  activeCourse: CourseProgress | null;
};

export function CourseResultView({
  courseId,
  courseName,
  place,
  isLoading = false,
  mapX,
  mapY,
  scale,
  prefs,
  availability,
  generatedAt,
  isAuthenticated,
  activeCourse,
}: Props) {
  const [authNotice, setAuthNotice] = useState(false);
  // 기존 진행 중인 외출을 종료하고 새로 시작하는 것을 확인받는 패널
  const [replaceActiveNotice, setReplaceActiveNotice] = useState(false);

  const router = useRouter();
  const queryClient = useQueryClient();
  const startCourse = useCourseProgressStore((s) => s.start);

  const {
    currentCourseId,
    currentPlace,
    currentCourseName,
    isBadgeSnapshotStale,
    rerollExhausted,
    newPlaceId,
    rerolling,
    isMaxRerolls,
    rejectPanelOpen,
    openRejectPanel,
    closeRejectPanel,
    rejectReason,
    setRejectReason,
    confirmReject,
  } = useCourseResult({ courseId, courseName, place, generatedAt, mapX, mapY, scale, prefs });

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

    // 진행 중인 외출이 이미 있으면 곧바로 시작하지 않고 먼저 확인을 받는다 —
    // 새로 시작하면 그 기록이 종료된다는 걸 사용자가 알고 선택하게 한다.
    if (activeCourse) {
      setReplaceActiveNotice(true);
      return;
    }

    proceedStart();
  };

  const handleConfirmReplace = () => {
    setReplaceActiveNotice(false);
    proceedStart();
  };

  const proceedStart = () => {
    // 낙관적 이동 — startCourseAction 완료를 기다리지 않고 즉시 진행 화면으로 전환한다.
    startCourse(currentCourseId);
    router.push(`/course/active/${currentCourseId}`);

    void startCourseAction({
      courseName: currentCourseName,
      scale: scale ?? "moderate",
      place: currentPlace,
    }).then((result) => {
      // 세션 만료 등 엣지 — 이미 다른 화면(코스 진행)으로 낙관적 이동한 뒤라 이 컴포넌트는
      // 대부분 이미 언마운트된 상태다. 그래서 로컬 토스트(authNotice)로는 안내가 보이지
      // 않을 수 있어, 로그인 화면 쪽에서 사유를 읽어 배너로 보여주는 redirectToSignIn을 쓴다.
      if (!result.ok) {
        if (result.reason === "unauthenticated") {
          queryClient.clear();
          redirectToSignIn("session_expired");
        }
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

  // 상태 배지 — 선택 진입(직접 고른 장소)은 실측 운영 여부(availability.isOpenNow)로,
  // 추천 진입은 파싱 성공 여부(availabilityUncertain)로 열림 판정한다(둘 다 "확정 열림"이면 true로 통일).
  // "판단 불가"(isOpenNow===null / uncertain===true)는 원인에 따라 다시 나뉜다: hours 원문 자체가
  // 있는데 파서가 이해 못한 "진짜 파싱 실패"만 완곡한 배지로 알리고, hours가 아예 없는 경우
  // (API 오류·데이터 미비)는 처리 실패가 아니므로 파이프라인의 관대 통과 철학과 같게 열림으로 본다.
  const isSelectedEntry = currentPlace.origin === "selected";
  const isConfidentlyOpen = isSelectedEntry
    ? availability?.isOpenNow === true
    : !currentPlace.availabilityUncertain;
  const isConfidentlyClosed = isSelectedEntry && availability?.isOpenNow === false;
  const uncertainHours = isSelectedEntry ? availability?.hours : currentPlace.hours;

  const availabilityBadge: { text: string; variant: "accent" | "point" | "outline" } | null =
    isBadgeSnapshotStale
      ? null
      : isConfidentlyClosed
        ? { text: "운영시간 확인 필요", variant: "point" }
        : isConfidentlyOpen
          ? { text: "지금 출발 가능", variant: "accent" }
          : uncertainHours?.trim()
            ? { text: "운영 여부 확인 권장", variant: "outline" }
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
              ) : availabilityBadge.variant === "outline" ? (
                <Clock size={11} className="inline-block mr-1" />
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

        {/* 정보 행 — 장소 / 일정 / 예상 체류 / (축제 전용) 공식 사이트.
            각 행에 소제목을 붙여 드로어를 열지 않아도 항목이 뭔지 바로 파악되게 한다. */}
        {(currentPlace.addr ||
          currentPlace.hours?.trim() ||
          currentPlace.dur ||
          currentPlace.organizerUrl) && (
          <div className="flex flex-col gap-3">
            {currentPlace.addr && (
              <div className="flex items-start gap-2.5">
                <MapPin size={16} className="text-text-secondary shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold text-text-secondary mb-0.5">
                    장소
                  </p>
                  <p className="text-[14px] text-text-primary">{currentPlace.addr}</p>
                </div>
              </div>
            )}
            {currentPlace.hours?.trim() && (
              <div className="flex items-start gap-2.5">
                <Clock size={16} className="text-text-secondary shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold text-text-secondary mb-0.5">
                    일정
                  </p>
                  <div className="text-[14px] text-text-primary">
                    {currentPlace.hours.split("\n").map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {currentPlace.dur && (
              <div className="flex items-start gap-2.5">
                <Calendar size={16} className="text-text-secondary shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold text-text-secondary mb-0.5">
                    예상 체류시간
                  </p>
                  <p className="text-[14px] text-text-primary">
                    {currentPlace.dur}
                    <span className="ml-1.5 text-[11px] text-text-secondary">
                      카테고리 평균 기준
                    </span>
                  </p>
                </div>
              </div>
            )}
            {currentPlace.organizerUrl && (
              <div className="flex items-start gap-2.5">
                <Globe size={16} className="text-text-secondary shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold text-text-secondary mb-0.5">
                    공식 사이트
                  </p>
                  <a
                    href={currentPlace.organizerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] font-semibold text-primary"
                  >
                    홈페이지
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 운영시간 안내 링크 — 파싱 실패 장소에만 노출 */}
        {currentPlace.availabilityUncertain && currentPlace.name?.trim() && (
          <HoursInfoCard placeName={currentPlace.name} />
        )}

        {/* 소개 — 2줄 클램프 + 더보기/접기 토글 */}
        {currentPlace.desc?.trim() && (
          <PlaceDescription key={currentPlace.id} desc={currentPlace.desc} />
        )}

        {/* 축제 전용 — 행사 프로그램. programInfo가 없으면(장소이거나 Tour API 미매칭
            축제) 섹션 자체를 렌더하지 않는다. */}
        {currentPlace.programInfo && (
          <div className="mt-4 pt-4 border-t border-dashed border-border">
            <p className="text-[13px] font-bold text-text-primary mb-2">행사 프로그램</p>
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-[12.5px] font-semibold text-text-secondary mb-1">
                  주요 프로그램
                </p>
                <p className="text-[14px] leading-[1.55] text-text-primary whitespace-pre-line">
                  {currentPlace.programInfo.main}
                </p>
              </div>
              {currentPlace.programInfo.extra.length > 0 && (
                <div>
                  <p className="text-[12.5px] font-semibold text-text-secondary mb-1.5">
                    부대 행사 및 프로그램
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentPlace.programInfo.extra.map((item, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-0.5 rounded-full border border-border text-[11.5px] font-medium text-text-primary"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 장소 지도 미리보기 — 마커 1개, 인터랙션은 SDK 기본값.
            길찾기는 "여기 갈 만한 거리인가"를 커밋 전에 가볍게 가늠해보라는 보조 장치라,
            주 CTA("여기로 갈게요")보다 눈에 띄지 않게 지도 위 작은 pill로만 둔다. */}
        {placeCoord && (
          <div className="relative mt-3 h-45 rounded-xl overflow-hidden border border-border">
            <CourseMap mainPlace={{ name: currentPlace.name, coord: placeCoord }} />
            <a
              href={`https://map.kakao.com/link/map/${encodeURIComponent(currentPlace.name)},${placeCoord.lat},${placeCoord.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute z-10 bottom-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-background/95 backdrop-blur-xs border border-border shadow-md text-[11px] font-semibold text-text-secondary active:scale-95 transition-transform"
            >
              <Navigation size={12} strokeWidth={2.2} />
              길찾기
            </a>
          </div>
        )}


        {/* 보조 정보 — 근처 맛집 (단일 장소 추천을 흐리지 않는 보조 수준).
            축제를 다른 장소의 곁다리 정보로 보여주던 옛 섹션은 제거됨 — 이제 축제는
            홈 화면에서 직접 목적지로 선택 가능하므로 이 화면에 곁다리로 얹을 이유가 없다. */}
        {prefs?.food === "matjip" && placeCoord && (
          <div className="mt-3">
            <NearbyRestaurants
              placeName={currentPlace.name}
              addr={currentPlace.addr}
              coord={placeCoord}
            />
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
              <Button size="cta" disabled={!rejectReason} onClick={confirmReject}>
                여기 말고 다른 곳으로
              </Button>
              <button
                onClick={closeRejectPanel}
                className="w-full h-10 text-[13px] font-medium text-text-secondary"
              >
                취소
              </button>
            </>
          )
        ) : (
          <>
            {/* 예정(시작 전) 축제는 "여기로 갈게요"가 성립하지 않는다 — 진행 화면은
                "지금 그 장소에 가 있다"를 전제로 하는데 아직 시작도 안 했기 때문이다.
                버튼 대신 안내문으로 대체하고 액션은 없다(종료된 축제는 목록에 나온 적이
                없어 여기서 다루지 않는다 — splitOngoingUpcoming이 ongoing/upcoming만 반환). */}
            {currentPlace.festivalPhase === "upcoming" ? (
              <div className="w-full h-13 rounded-full bg-muted text-text-secondary text-[15px] font-semibold flex items-center justify-center">
                {currentPlace.festivalStartLabel}부터 방문할 수 있어요
              </div>
            ) : (
              <Button size="cta" className="w-full" onClick={handleStart}>
                여기로 갈게요
              </Button>
            )}
            {/* 취향 다시 설정·재추천 — 둘 다 취향 기반 추천이 마음에 안 들 때의 탈출구라,
                사용자가 직접 고른 장소(origin="selected": 홈 인기 장소·주변 축제 선택 둘 다)
                에는 성립하지 않는다. */}
            {currentPlace.origin !== "selected" && (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => router.push("/start")}
                  className="h-12 text-[15px] font-medium text-text-secondary flex items-center justify-center gap-1.5"
                >
                  <Settings2 size={15} /> 취향 다시 설정
                </button>
                <button
                  onClick={openRejectPanel}
                  disabled={isMaxRerolls || rerolling}
                  className={cn(
                    "h-12 text-[15px] font-medium text-point flex items-center justify-center gap-1.5",
                    (isMaxRerolls || rerolling) && "opacity-40 cursor-not-allowed",
                  )}
                >
                  <ThumbsDown size={15} /> 이런 곳은 싫어요
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 진행 중인 외출 종료 확인 모달 */}
      <Dialog open={replaceActiveNotice} onOpenChange={setReplaceActiveNotice}>
        <DialogContent
          showCloseButton={false}
          className="max-w-85 gap-3 p-6 text-center"
        >
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-point/10 border border-point/40">
            <AlertCircle size={20} className="text-point" />
          </div>
          <DialogTitle className="text-[17px] font-extrabold text-text-primary text-center">
            진행 중인 외출이 있어요
          </DialogTitle>
          <p className="text-[13px] leading-[1.55] text-text-secondary text-center">
            <span className="font-bold text-point">{activeCourse?.name}</span>{" "}
            외출이 아직 진행 중이에요. 새로 시작하면 이 기록은 종료돼요.
          </p>
          <div className="flex flex-col gap-2.5 mt-1">
            {activeCourse && (
              <Button
                size="cta"
                variant="accent"
                onClick={() => router.push(`/course/active/${activeCourse.courseId}`)}
              >
                {activeCourse.name} 이어가기
              </Button>
            )}
            <Button
              size="cta"
              variant="outline"
              className="border-point/45 text-point hover:bg-point/5"
              onClick={handleConfirmReplace}
            >
              새로 시작할게요
            </Button>
            <button
              onClick={() => setReplaceActiveNotice(false)}
              className="w-full h-9 text-[13px] font-medium text-text-secondary/70"
            >
              취소
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {authNotice && (
        <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom,6px))] left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-foreground text-background text-[13px] font-medium shadow-lg max-w-[calc(100vw-32px)] text-center">
          로그인하면 외출을 시작하고 기록할 수 있어요
        </div>
      )}
    </>
  );
}
