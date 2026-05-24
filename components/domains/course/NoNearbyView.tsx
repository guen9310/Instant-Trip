"use client";

import Link from "next/link";
import { MapPin, Search, Clock, ChevronRight, AlertTriangle } from "lucide-react";
import type { ElementType } from "react";
import { cn } from "@/shared/utils";
import { Button } from "@/components/commons/Button";

interface NoNearbyViewProps {
  city: string;
  onExpandRadius: () => void;
  onChangeScale: () => void;
  onChangeRegion: () => void;
}

export function NoNearbyView({
  city,
  onExpandRadius,
  onChangeScale,
  onChangeRegion,
}: NoNearbyViewProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4">
        {/* 위치 카드 */}
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-accent/9 border border-accent/20 mb-5">
          <MapPin size={20} className="text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-text-primary">{city}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="text-xs text-accent font-medium">현재 위치 확인됨</span>
            </div>
          </div>
        </div>

        {/* 경고 배너 */}
        <div className="flex gap-3 items-start px-4 py-3.5 rounded-xl bg-point/12 border border-point/20 mb-7">
          <AlertTriangle size={20} className="text-point shrink-0 mt-0.5" strokeWidth={2} />
          <div>
            <p className="text-[14px] font-bold text-text-primary tracking-tight mb-0.5">
              근처 코스를 찾지 못했어요
            </p>
            <p className="text-[13px] text-text-secondary leading-[1.4]">
              현재 반경 5km 내 영업 중인 관광지가 없어요
            </p>
          </div>
        </div>

        {/* 옵션 목록 */}
        <p className="text-[14px] font-bold text-text-primary tracking-tight mb-3">
          이렇게 해볼까요?
        </p>
        <div className="flex flex-col gap-2.5">
          <OptionCard
            icon={Search}
            title="반경 넓혀서 다시 찾기"
            sub="10km로 확장"
            onClick={onExpandRadius}
          />
          <OptionCard
            icon={Clock}
            title="여행 규모 변경하기"
            sub="더 넓은 범위로 조정"
            onClick={onChangeScale}
          />
          <OptionCard
            icon={MapPin}
            title="다른 지역 선택하기"
            sub="지역을 직접 입력"
            onClick={onChangeRegion}
          />
        </div>
      </div>

      {/* CTA 바 */}
      <div className="border-t border-border bg-background px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,8px))]">
        <Link href="/" className="block">
          <Button
            variant="ghost"
            size="cta"
            className={cn("w-full text-text-primary hover:text-text-primary")}
          >
            처음으로 돌아가기
          </Button>
        </Link>
      </div>
    </>
  );
}

function OptionCard({
  icon: Ico,
  title,
  sub,
  onClick,
}: {
  icon: ElementType;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3.5 px-3.5 py-3.5 rounded-xl bg-surface border border-border active:bg-primary/5 active:border-primary/30 transition-colors text-left w-full"
    >
      <div className="w-10 h-10 rounded-[10px] bg-primary/8 text-primary flex items-center justify-center shrink-0">
        <Ico size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-text-primary tracking-tight mb-0.5">{title}</p>
        <p className="text-xs text-text-secondary">{sub}</p>
      </div>
      <ChevronRight size={18} className="text-text-secondary shrink-0" />
    </button>
  );
}
