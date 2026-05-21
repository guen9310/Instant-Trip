"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Footprints, Map, Compass, Check, Shuffle, AlertCircle } from "lucide-react";
import { cn } from "@/shared/utils";
import { Button } from "@/components/commons/Button";
import { CourseLoadingOverlay } from "@/components/domains/course/CourseLoadingOverlay";
import { useLocationStore } from "@/client/stores/useLocationStore";
import Link from "next/link";

const SCALES = [
  {
    id: "light" as const,
    icon: Footprints,
    title: "오늘은 산책이면 충분해",
    desc: "2~3시간 · 동네 한 바퀴 · 장소 1~2곳",
    radius: "반경 3~5km",
  },
  {
    id: "moderate" as const,
    icon: Map,
    title: "반나절쯤 어딘가 다녀오고 싶어",
    desc: "반나절 · 근교 나들이 · 장소 2~3곳",
    radius: "반경 10~15km",
  },
  {
    id: "leisurely" as const,
    icon: Compass,
    title: "오늘 하루 제대로 쓰고 싶어",
    desc: "하루 · 당일치기 · 장소 3~5곳",
    radius: "반경 20~30km",
  },
];

type ScaleId = (typeof SCALES)[number]["id"];

export function StartView() {
  const [selected, setSelected] = useState<ScaleId>("moderate");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const city = useLocationStore((s) => s.city);

  const handleStart = async () => {
    setLoading(true);
    // TODO: 코스 생성 API 호출로 교체
    await new Promise((r) => setTimeout(r, 2500));
    router.push("/course/1");
  };

  return (
    <>
      {loading && <CourseLoadingOverlay />}

      <div className="flex flex-1 flex-col px-4 pt-5 pb-4">
        {/* 위치 카드 */}
        {city ? (
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-accent/9 border border-accent/20 mb-7">
            <MapPin size={20} className="text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-text-primary">{city}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span className="text-xs text-accent font-medium">위치 확인됨</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-point/8 border border-point/20 mb-7">
            <AlertCircle size={20} className="text-point shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-text-primary">위치를 확인할 수 없어요</p>
              <Link href="/location" className="text-xs text-point font-medium underline-offset-2 underline">
                지역 직접 선택하기
              </Link>
            </div>
          </div>
        )}

        <h2 className="text-[22px] font-bold text-text-primary tracking-[-0.02em] mb-1.5">
          오늘 얼마나 떠날까요?
        </h2>
        <p className="text-[13px] text-text-secondary mb-5">
          선택한 템포에 맞게 코스를 즉석에서 짜드려요
        </p>

        <div className="flex flex-1 flex-col gap-2.5">
          {SCALES.map((s) => {
            const sel = selected === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={cn(
                  "flex flex-1 items-center gap-3.5 p-4 rounded-xl border text-left transition-colors active:scale-[0.98]",
                  sel ? "bg-primary/5 border-primary" : "bg-card border-border"
                )}
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                    sel ? "bg-surface text-primary" : "bg-muted text-text-primary"
                  )}
                >
                  <s.icon size={24} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-bold text-text-primary mb-0.5">{s.title}</p>
                  <p className="text-xs text-text-secondary leading-[1.4]">{s.desc}</p>
                  <p
                    className={cn(
                      "text-[11px] font-medium mt-1",
                      sel ? "text-primary" : "text-text-secondary"
                    )}
                  >
                    {s.radius}
                  </p>
                </div>
                {sel && (
                  <div className="w-[22px] h-[22px] rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Check size={14} color="white" strokeWidth={3} />
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
