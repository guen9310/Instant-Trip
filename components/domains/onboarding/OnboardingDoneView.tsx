"use client";

import Link from "next/link";
import { Sparkles, MapPin, Zap, Navigation } from "lucide-react";
import { Button } from "@/components/commons/Button";

const HIGHLIGHTS = [
  { icon: Zap, text: "취향에 맞는 코스를 즉석에서 생성해드려요" },
  { icon: MapPin, text: "지금 영업 중인 곳만 골라 추천해드려요" },
  { icon: Navigation, text: "마음에 안 드는 장소는 언제든 교체할 수 있어요" },
];

export function OnboardingDoneView() {
  return (
    <div className="flex min-h-svh flex-col bg-background px-6">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {/* 아이콘 */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-primary/8 flex items-center justify-center">
            <Sparkles size={36} className="text-primary" strokeWidth={2} />
          </div>
          <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-accent flex items-center justify-center text-white text-[14px]">
            ✓
          </span>
        </div>

        {/* 헤딩 */}
        <h1 className="text-[28px] font-extrabold text-text-primary tracking-[-0.03em] leading-[1.15] mb-3 text-balance">
          준비됐어요!
        </h1>
        <p className="text-[14px] text-text-secondary leading-[1.55] mb-10 text-balance">
          설정한 취향을 바탕으로 지금 바로 코스를 만들어드릴게요.
        </p>

        {/* 기능 하이라이트 */}
        <div className="w-full flex flex-col gap-3 mb-10">
          {HIGHLIGHTS.map((h, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/8 text-primary flex items-center justify-center shrink-0">
                <h.icon size={16} strokeWidth={2.2} />
              </div>
              <p className="text-[13px] text-text-secondary leading-[1.4]">{h.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="pb-[calc(24px+env(safe-area-inset-bottom,8px))]">
        <Link href="/">
          <Button size="cta" className="w-full">
            지금 시작하기
          </Button>
        </Link>
        <Link
          href="/settings"
          className="block text-center mt-3 py-2 text-[13px] text-text-secondary font-medium"
        >
          취향 설정 다시 하기
        </Link>
      </div>
    </div>
  );
}
