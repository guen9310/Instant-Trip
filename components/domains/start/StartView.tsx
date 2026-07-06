"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Footprints,
  Map,
  Compass,
  Check,
  Shuffle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { Button } from "@/components/commons/Button";
import { CourseLoadingOverlay } from "@/components/domains/course/CourseLoadingOverlay";
import { LocationDeniedView } from "@/components/domains/location/LocationDeniedView";
import { NoNearbyView } from "@/components/domains/course/NoNearbyView";
import { useLocationStore } from "@/client/stores/useLocationStore";
import { usePrefsStore } from "@/client/stores/usePrefsStore";
import { generateCourseAction } from "@/app/actions/course";
import type { PendingCourse } from "@/shared/types/course.types";

const SCALES = [
  {
    id: "light" as const,
    icon: Footprints,
    title: "오늘은 산책이면 충분해",
    iconColor: "text-accent",
    iconBg: "bg-accent/10",
    unselBg: "bg-accent/[0.04] hover:bg-accent/[0.08]",
  },
  {
    id: "moderate" as const,
    icon: Map,
    title: "반나절쯤 어딘가 다녀오고 싶어",
    iconColor: "text-secondary",
    iconBg: "bg-secondary/10",
    unselBg: "bg-card hover:bg-secondary/[0.06]",
  },
  {
    id: "leisurely" as const,
    icon: Compass,
    title: "오늘 하루 제대로 쓰고 싶어",
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
    unselBg: "bg-primary/[0.04] hover:bg-primary/[0.08]",
  },
];

type ScaleId = (typeof SCALES)[number]["id"];

export function StartView() {
  const [selected, setSelected] = useState<ScaleId>("moderate");
  const [loading, setLoading] = useState(false);
  const [noNearby, setNoNearby] = useState(false);
  // 마지막 생성 시도에 실제 사용된 검색 반경(m) — NoNearbyView 문구·확장 반경 계산용
  const [searchRadiusM, setSearchRadiusM] = useState<number | null>(null);
  const [showManualPicker, setShowManualPicker] = useState(false);
  const router = useRouter();
  const { state, setCity } = useLocationStore();
  const { prefs } = usePrefsStore();

  const generate = async (radiusM?: number) => {
    if (state.status !== "granted" || !state.lat || !state.lng) {
      console.warn("[StartView] coords 없음 — 코스 생성 중단");
      return;
    }
    const coords = { lat: state.lat, lng: state.lng };

    setLoading(true);

    const result = await generateCourseAction({
      mapX: coords.lng,
      mapY: coords.lat,
      scale: selected,
      prefs,
      radiusM,
    });

    if (!result.ok) {
      setLoading(false);
      if (result.code === "NO_PLACE") {
        setSearchRadiusM(result.radiusM);
        setNoNearby(true);
      }
      return;
    }

    const pending: PendingCourse = {
      courseId: result.courseId,
      place: result.place,
      courseName: result.courseName,
      festivals: result.festivals,
      mapX: coords.lng,
      mapY: coords.lat,
      scale: selected,
    };
    localStorage.setItem("pendingCourse", JSON.stringify(pending));
    router.push("/course/preview");
  };

  const isDenied =
    state.status === "denied" ||
    state.status === "timeout" ||
    state.status === "unavailable";
  const city = state.status === "granted" ? state.city : null;

  // 위치 권한 거부/불가 → 지역 직접 선택 UI
  if (isDenied || showManualPicker) {
    return (
      <LocationDeniedView
        variant={isDenied ? "denied" : "manual"}
        onCitySelect={(selectedCity) => {
          setCity(selectedCity);
          setShowManualPicker(false);
          setNoNearby(false);
        }}
      />
    );
  }

  // 주변 코스 없음 → 대안 선택 UI
  if (noNearby && city) {
    const searchRadiusKm = searchRadiusM !== null ? searchRadiusM / 1000 : null;
    // 확장 반경 = 현재의 2배(5→10→20km), 최대 반경(20km)에서 실패했으면 확장 옵션 숨김
    const expandedRadiusKm =
      searchRadiusKm !== null && searchRadiusKm < 20
        ? searchRadiusKm * 2
        : null;

    return (
      <>
        {loading && <CourseLoadingOverlay />}
        <NoNearbyView
          city={city}
          radiusKm={searchRadiusKm}
          expandedRadiusKm={expandedRadiusKm}
          onExpandRadius={() => {
            if (expandedRadiusKm !== null) generate(expandedRadiusKm * 1000);
          }}
          onChangeScale={() => setNoNearby(false)}
          onChangeRegion={() => setShowManualPicker(true)}
        />
      </>
    );
  }

  const handleStart = () => generate();

  return (
    <>
      {loading && <CourseLoadingOverlay />}

      <div className="flex flex-1 flex-col px-4 pt-5 pb-4">
        {/* 위치 카드 */}
        {city ? (
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-accent/9 border border-accent/20 mb-7">
            <MapPin size={20} className="text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-text-primary">
                {city}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span className="text-xs text-accent font-medium">
                  위치 확인됨
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-point/8 border border-point/20 mb-7">
            <AlertCircle size={20} className="text-point shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-text-primary">
                위치를 확인할 수 없어요
              </p>
              <button
                onClick={() => setShowManualPicker(true)}
                className="text-xs text-point font-medium underline-offset-2 underline"
              >
                지역 직접 선택하기
              </button>
            </div>
          </div>
        )}

        <h2 className="text-[22px] font-bold text-text-primary tracking-[-0.02em] mb-1.5">
          오늘 얼마나 떠날까요?
        </h2>
        <p className="text-[13px] text-text-secondary mb-5">
          지금 갈 만한 곳을 골라드려요
        </p>

        <div className="flex flex-col gap-3">
          {SCALES.map((s) => {
            const sel = selected === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-4 rounded-xl border text-left transition-colors active:scale-[0.98]",
                  sel
                    ? "bg-primary/5 border-primary"
                    : `${s.unselBg} border-border`,
                )}
              >
                <div
                  className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
                    s.iconBg,
                    s.iconColor,
                  )}
                >
                  <s.icon size={28} strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-bold text-text-primary">
                    {s.title}
                  </p>
                </div>
                {sel && (
                  <div className="w-5.5 h-5.5 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Check size={13} color="white" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA 바 */}
      <div className="border-t border-border bg-background px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,8px))]">
        <Button
          size="cta"
          onClick={handleStart}
          disabled={loading || !city}
          className="gap-2"
        >
          코스 뽑기 <Shuffle size={16} />
        </Button>
      </div>
    </>
  );
}
