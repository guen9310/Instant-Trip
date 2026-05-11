"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Footprints, Map, Compass, Check, Sparkles } from "lucide-react";
import { cn } from "@/shared/utils";
import { Button } from "@/components/commons/Button";

const SCALES = [
  {
    id: "light" as const,
    icon: Footprints,
    title: "가볍게",
    desc: "2~3시간 · 동네 한 바퀴 · 장소 1~2곳",
    radius: "반경 3~5km",
  },
  {
    id: "moderate" as const,
    icon: Map,
    title: "적당히",
    desc: "반나절 · 근교 나들이 · 장소 2~3곳",
    radius: "반경 10~15km",
  },
  {
    id: "leisurely" as const,
    icon: Compass,
    title: "여유롭게",
    desc: "하루 · 당일치기 · 장소 3~5곳",
    radius: "반경 20~30km",
  },
];

type ScaleId = (typeof SCALES)[number]["id"];

function LoadingOverlay() {
  const messages = [
    "지금 영업 중인 곳을 확인하는 중...",
    "오늘 열리는 행사를 찾는 중...",
    "최적의 동선을 계산하는 중...",
  ];
  const [msgIdx, setMsgIdx] = useState(0);
  const [dotIdx, setDotIdx] = useState(0);

  useEffect(() => {
    const m = setInterval(() => setMsgIdx((i) => (i + 1) % messages.length), 1200);
    const d = setInterval(() => setDotIdx((i) => (i + 1) % 3), 400);
    return () => {
      clearInterval(m);
      clearInterval(d);
    };
  }, [messages.length]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background gap-6">
      <style>{`
        @keyframes zat-ring {
          0% { transform: scale(0.6); opacity: 0.7; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
      <div className="relative w-[120px] h-[120px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute inset-0 rounded-full border-2 border-primary"
            style={{ animation: `zat-ring 1.6s ease-out ${i * 0.5}s infinite` }}
          />
        ))}
        <div className="absolute inset-6 rounded-full bg-primary flex items-center justify-center">
          <Sparkles size={32} className="text-white" strokeWidth={2} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-[16px] font-bold text-text-primary tracking-tight mb-2">
          코스를 만들고 있어요
        </p>
        <p className="text-[13px] text-text-secondary">{messages[msgIdx]}</p>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-accent transition-opacity duration-200"
            style={{ opacity: i === dotIdx ? 1 : 0.25 }}
          />
        ))}
      </div>
    </div>
  );
}

export function StartView() {
  const [selected, setSelected] = useState<ScaleId>("moderate");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleStart = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 2500));
    router.push("/course/1");
  };

  return (
    <>
      {loading && <LoadingOverlay />}

      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4">
        {/* 위치 카드 */}
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-accent/9 border border-accent/20 mb-7">
          <MapPin size={20} className="text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-text-primary">서울특별시 종로구</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="text-xs text-accent font-medium">현재 위치 확인됨</span>
            </div>
          </div>
        </div>

        <h2 className="text-[22px] font-bold text-text-primary tracking-[-0.02em] mb-1.5">
          어떻게 떠나실 건가요?
        </h2>
        <p className="text-[13px] text-text-secondary mb-5">
          이동 거리와 머무는 시간에 맞춰 코스를 짜드려요
        </p>

        <div className="flex flex-col gap-2.5">
          {SCALES.map((s) => {
            const sel = selected === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={cn(
                  "flex items-center gap-3.5 p-4 rounded-xl border text-left transition-colors active:scale-[0.98]",
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
          disabled={loading}
          className="gap-2"
        >
          코스 뽑기 <Sparkles size={16} />
        </Button>
      </div>
    </>
  );
}
