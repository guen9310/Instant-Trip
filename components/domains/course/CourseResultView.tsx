"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Settings2,
  Clock,
  Calendar,
  AlertCircle,
  MapPin,
  ThumbsDown,
  Navigation,
  RefreshCcw,
  Globe,
  CloudRain,
  CloudSnow,
  Thermometer,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { Badge } from "@/components/commons/Badge";
import { Button } from "@/components/commons/Button";
import { Dialog, DialogContent, DialogTitle } from "@/components/commons/Dialog";
import { useCourseProgressStore } from "@/client/stores/useCourseProgressStore";
import { useCourseResult } from "@/client/hooks/useCourseResult";
import type { ReasonChipKind } from "@/client/hooks/useCourseResult";
import type { LucideIcon } from "lucide-react";
import { redirectToSignIn } from "@/client/redirectToSignIn";
import { startCourseAction } from "@/app/actions/completion";
import type {
  JourneyPlace,
  PendingCourse,
  PlaceAvailabilitySnapshot,
  CourseProgress,
  WeatherSwitchReason,
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

// 재추천 사유 설명 칩 — useCourseResult가 "그 사유가 실제로 해소됐는지"까지
// 검증한 뒤에만 kind를 채워주므로, 여기서는 문구/아이콘 매핑만 한다.
const REASON_CHIP_COPY: Record<ReasonChipKind, { icon: LucideIcon; text: string }> = {
  far: { icon: Navigation, text: "이전 장소보다 가까워요" },
  time: { icon: Clock, text: "지금 확실히 운영 중이에요" },
  visited: { icon: RefreshCcw, text: "이번엔 다른 곳으로 골라봤어요" },
};

// satisfied:false(폴백) 전용 문구 — "far"만 해당한다(useCourseResult.ts 참고: "time"은
// 만족 못 하면 칩 자체를 안 켜고, "visited"는 폴백이 존재하지 않는다). 성공 칩과
// 다르게 아이콘 없이 중립 톤으로 렌더해 "요청은 성공 못 했지만 알려는 준다"는
// 인상을 준다.
const REASON_CHIP_FALLBACK_TEXT: Partial<Record<ReasonChipKind, string>> = {
  far: "이 근처엔 더 가까운 곳이 없었어요",
};

// 실외→실내 전환 안내 — rerollExhausted와 같은 구조지만 경고가 아니라 point 대신
// primary 톤. 원래 장소명은 노출하지 않는다(혼란만 준다).
const WEATHER_SWITCH_ICON: Record<WeatherSwitchReason, LucideIcon> = {
  rain: CloudRain,
  snow: CloudSnow,
  heatwave: Thermometer,
};
const WEATHER_SWITCH_TEXT: Record<WeatherSwitchReason, string> = {
  rain: "비 예보가 있어 실내 장소를 추천해드렸어요.",
  snow: "눈 예보가 있어 실내 장소를 추천해드렸어요.",
  heatwave: "폭염이 예상돼 실내 장소를 추천해드렸어요.",
};

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
  // 날씨 게이트가 실외→실내로 전환했으면 사유. generateCourse() 경로(취향 기반
  // 추천)에서만 채워진다 — 선택/축제 진입은 undefined.
  weatherSwitch?: WeatherSwitchReason | null;
  // 서버 컴포넌트(page.tsx)에서 getAuthState()로 미리 판정 — 탭 시 서버 왕복 없이
  // 즉시 분기하기 위함 (비로그인은 안내 후 이동, 로그인은 낙관적 이동).
  isAuthenticated: boolean;
  // page.tsx가 getAuthState()로 미리 판정 — 이 화면은 proxy.ts가 /course를 보호 경로로
  // 걸러낸 뒤라 !isAuthenticated는 항상 세션이 서버에서 무효화된 경우(invalid_session)뿐이다.
  // 그래도 계약을 명시적으로 분리해, 로그인 자체가 필요한 안내(authNotice)와 세션 만료
  // 배너를 혼동하지 않게 한다.
  sessionExpired: boolean;
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
  weatherSwitch: initialWeatherSwitch,
  isAuthenticated,
  sessionExpired,
  activeCourse,
}: Props) {
  const [authNotice, setAuthNotice] = useState(false);
  // 기존 진행 중인 외출을 종료하고 새로 시작하는 것을 확인받는 패널
  const [replaceActiveNotice, setReplaceActiveNotice] = useState(false);

  const router = useRouter();
  const queryClient = useQueryClient();
  const startCourse = useCourseProgressStore((s) => s.start);
  const resetRerolls = useCourseProgressStore((s) => s.resetRerolls);

  const {
    currentCourseId,
    currentPlace,
    currentCourseName,
    isBadgeSnapshotStale,
    rerollExhausted,
    reasonChip,
    weatherSwitch,
    newPlaceId,
    rerolling,
    isMaxRerolls,
    rejectPanelOpen,
    openRejectPanel,
    closeRejectPanel,
    rejectReason,
    setRejectReason,
    confirmReject,
  } = useCourseResult({
    courseId,
    courseName,
    place,
    generatedAt,
    mapX,
    mapY,
    scale,
    prefs,
    weatherSwitch: initialWeatherSwitch,
  });

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
      // 세션이 무효화된 경우엔 "로그인하면~" 안내가 아니라 로그인 화면의 만료 배너로
      // 곧바로 보낸다 — redirectToSignIn은 하드 네비게이션이라 이 컴포넌트 언마운트
      // 여부와 무관하게 항상 배너가 뜬다.
      if (sessionExpired) {
        redirectToSignIn("session_expired");
        return;
      }
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
    // 실제로 출발을 확정하는 지점 — 이번 탐색에서 쌓인 거절 이력을 여기서 끊는다.
    // (재추천 시점(useGenerateCourse)엔 일부러 안 지운다 — 거절한 장소가 같은 탐색
    // 안에서 계속 제외되게 하려는 목적이라, 실제 출발해야만 다음 탐색을 위해 리셋한다.)
    resetRerolls();
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
        // "anonymous"는 이 화면에 이론상 나타나지 않는다(위 handleStart의 isAuthenticated
        // 체크가 이미 막음) — 그래도 서버 액션의 계약을 그대로 존중해 invalid_session만
        // 로그인 화면 배너로 연결한다.
        if (result.reason === "invalid_session") {
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

  // 상태 배지 — lib/tour/hours.ts의 status 체계를 그대로 반영한다.
  // 추천 진입은 CoursePlace/PlaceCandidate가 status 필드 자체를 갖지 않는다 — 게이트
  // (availabilityGate.ts)를 거치며 이미 boolean(availabilityUncertain)으로 축약된
  // 값만 여기까지 전달된다. 정상 채택 경로(open/no_data/uncertain 채택)는 이 boolean이
  // 실제 status와 1:1로 대응하지만, 상한 소진·전 후보 거부 시의 1위 폴백 경로는 실제
  // status(예: closed_hours로 거부됐던 후보일 수 있음)를 버리고 무조건 true로 덮어쓴다
  // (availabilityGate.ts의 해당 주석 참고) — 그래서 여기서 신뢰할 수 있는 건 이 boolean
  // 하나뿐이고, "status가 open/no_data/uncertain 중 하나로 좁혀져 있다"고 가정하면 안 된다.
  // 선택 진입(직접 고른 장소·축제)은 게이트를 거치지 않아(의도적 비차단) status 원본이
  // 그대로 넘어온다 — closed_restday/closed_hours/past_admission_cutoff/insufficient_time도
  // 실제로 올라올 수 있어 이 경우만 "확정적으로 닫혀 있음"을 point 배지로 구분해서 보여준다.
  const isSelectedEntry = currentPlace.origin === "selected";

  const availabilityBadge: { text: string; variant: "accent" | "point" | "outline" } | null =
    (() => {
      if (isBadgeSnapshotStale) return null;

      if (!isSelectedEntry) {
        return currentPlace.availabilityUncertain
          ? { text: "운영시간 확인 필요", variant: "outline" }
          : { text: "지금 출발 가능", variant: "accent" };
      }

      // availability 자체가 없는 경우 — 구버전 localStorage 페이로드(이 필드 도입 전에
      // 저장된 선택 진입 코스)에서만 발생한다. no_data/uncertain은 "확인을 시도했지만
      // 알 수 없었다"는 근거라도 있지만, 이쪽은 신뢰할 스냅샷 자체가 없다 — "닫혀 있다"는
      // 근거는 물론 "확인이 필요하다"고 단정할 근거도 없으므로, isBadgeSnapshotStale과
      // 같은 태도로 배지 자체를 숨긴다(잘못된 확신을 주는 것보다 안전).
      if (!availability) return null;

      switch (availability.status) {
        case "open":
          return { text: "지금 출발 가능", variant: "accent" };
        case "no_data":
        case "uncertain":
          return { text: "운영시간 확인 필요", variant: "outline" };
        default:
          // closed_restday/closed_hours/past_admission_cutoff/insufficient_time —
          // 실제로 닫혀 있다는 근거가 있는 상태(게이트가 없어 여기까지 올라옴).
          return { text: "운영시간 확인 필요", variant: "point" };
      }
    })();

  // outline(no_data/uncertain)은 "확정 정보 아님"을 accent와 시각적으로 분명히
  // 구분하기 위해 중립색(Text Secondary)을 쓴다 — Badge의 outline 기본값은
  // text-primary라 그대로 두면 accent와 무게감 차이가 잘 드러나지 않는다.
  const availabilityBadgeClassName =
    availabilityBadge?.variant === "outline" ? "text-text-secondary" : undefined;

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
            <Badge
              variant={availabilityBadge.variant}
              className={cn("shrink-0 mt-0.5", availabilityBadgeClassName)}
            >
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
        {/* 취향 칩 + 재추천 사유 칩 — 세로 스택(gap 6px). 사유 칩은 리롤이 실제로
            그 사유를 해소했을 때만 useCourseResult가 채워준다(거짓 주장 방지 —
            useCourseResult.ts의 검증 로직 참고). */}
        {(prefs || reasonChip) && (
          <div className="flex flex-col items-start gap-1.5 mb-5">
            {prefs && (
              <div className="inline-flex self-start items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/8 text-primary text-[12px] font-medium">
                {`'${TRAVEL_REASON[prefs.travel] ?? prefs.travel}' 취향에 맞게 골랐어요`}
              </div>
            )}
            {reasonChip && (
              <div
                className={cn(
                  "inline-flex self-start items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] font-medium",
                  reasonChip.satisfied
                    ? "bg-point/10 text-point"
                    : "border border-border text-text-secondary",
                )}
              >
                {reasonChip.satisfied &&
                  (() => {
                    const ReasonIcon = REASON_CHIP_COPY[reasonChip.kind].icon;
                    return <ReasonIcon size={14} strokeWidth={2} />;
                  })()}
                {reasonChip.satisfied
                  ? REASON_CHIP_COPY[reasonChip.kind].text
                  : REASON_CHIP_FALLBACK_TEXT[reasonChip.kind]}
              </div>
            )}
          </div>
        )}

        {/* 날씨 게이트 전환 안내 — 경고가 아닌 도움말 톤(primary) */}
        {weatherSwitch && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-primary/8 border border-primary/20 mb-4">
            {(() => {
              const Icon = WEATHER_SWITCH_ICON[weatherSwitch];
              return <Icon size={16} className="text-primary shrink-0 mt-0.5" />;
            })()}
            <p className="text-[13px] text-primary leading-snug">
              {WEATHER_SWITCH_TEXT[weatherSwitch]}
            </p>
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

        {/* 대표 이미지 — imageUrl이 없어도 슬롯 높이는 항상 유지한다. 후보 사이를
            오갈 때(재추천·리롤) 이미지 유무에 따라 슬롯이 생겼다 사라지며
            아래 콘텐츠가 들썩이는 레이아웃 시프트를 막기 위함. PlaceThumbnail이
            imageUrl==null이면 카테고리 아이콘 플레이스홀더로 자체 폴백한다. */}
        <div className="w-full h-44 rounded-xl overflow-hidden mb-3">
          <PlaceThumbnail
            imageUrl={currentPlace.imageUrl}
            cat={currentPlace.cat}
            className="w-full h-full"
            sizes="100vw"
          />
        </div>

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

        {/* 소개 — 2줄 클램프 + 더보기/접기 토글. AnimatePresence는 mode="wait"를 쓰지
            않는다 — PlaceDescription은 key 변경 시 리마운트되어 마운트 직후 useEffect로
            hasMore(ref.scrollHeight)를 측정하는데, "wait"는 이전 요소의 exit 애니메이션이
            끝날 때까지 새 요소 마운트 자체를 늦춰 크로스페이드가 아니라 순차 전환이
            돼버린다. popLayout은 exit 중인 요소를 즉시 flow에서 빼(absolute) 새 요소가
            바로 그 자리에서 마운트·측정되게 하면서도 두 요소가 겹쳐 있는 동안 레이아웃
            높이가 늘어나는 튐을 막는다. */}
        {currentPlace.desc?.trim() && (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={currentPlace.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <PlaceDescription desc={currentPlace.desc} />
            </motion.div>
          </AnimatePresence>
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
      <div className="border-t border-border bg-background px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,8px))] flex flex-col gap-2 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {rejectPanelOpen ? (
            <motion.div
              key="reject-panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex flex-col gap-2"
            >
              {rerolling ? (
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
              )}
            </motion.div>
          ) : (
            <motion.div
              key="cta"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex flex-col gap-2"
            >
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
              {/* 외출 다시 정하기·재추천 — 둘 다 취향 기반 추천이 마음에 안 들 때의 탈출구라,
                  사용자가 직접 고른 장소(origin="selected": 홈 인기 장소·주변 축제 선택 둘 다)
                  에는 성립하지 않는다. "외출 다시 정하기"는 /start(여유 시간 재선택)로
                  보낼 뿐 취향(travel/party/vibe/food/indoor) 자체는 그대로 재사용된다 —
                  취향 편집은 설정/온보딩에만 있으므로 "취향 다시 설정"이라는 이전 문구는
                  이 화면이 실제로 하는 일과 어긋났다. */}
              {currentPlace.origin !== "selected" && (
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => router.push("/start")}
                    className="h-12 text-[15px] font-medium text-text-secondary flex items-center justify-center gap-1.5"
                  >
                    <Settings2 size={15} /> 다시 정하기
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
            </motion.div>
          )}
        </AnimatePresence>
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
            {activeCourse?.likelyForgotten
              ? "혹시 이미 다녀오셨나요?"
              : "진행 중인 외출이 있어요"}
          </DialogTitle>
          <p className="text-[13px] leading-[1.55] text-text-secondary text-center">
            <span className="font-bold text-point">{activeCourse?.name}</span>{" "}
            {activeCourse?.likelyForgotten
              ? "외출을 완료 처리하지 않으신 것 같아요. 새로 시작하면 이 기록은 종료돼요."
              : "외출이 아직 진행 중이에요. 새로 시작하면 이 기록은 종료돼요."}
          </p>
          <div className="flex flex-col gap-2.5 mt-1">
            {activeCourse && (
              // "다녀오신 것 같은" 경우에도 곧장 완료 화면으로 보내지 않고 진행 화면으로
              // 보낸다 — 완료 화면(useCourseDone)은 localStorage(pendingCourse)에
              // 의존하는데, 다른 기기이거나 저장소가 비었으면 완료 기록이 저장되지
              // 않고 조용히 홈으로 넘어가버릴 수 있다. 진행 화면은 이미 DB
              // fallback(getResumableCourse)이 있어 기기와 무관하게 복원되고,
              // "방문 완료" 버튼 한 번이면 끝나므로 이쪽이 더 안전하다.
              <Button
                size="cta"
                variant="accent"
                onClick={() => router.push(`/course/active/${activeCourse.courseId}`)}
              >
                {activeCourse.likelyForgotten
                  ? "확인하고 완료하기"
                  : `${activeCourse.name} 이어가기`}
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
