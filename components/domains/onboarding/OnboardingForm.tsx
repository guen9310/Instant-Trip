"use client";

import { useState } from "react";
import { Footprints, Navigation } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/shared/utils";
import { Button } from "@/components/commons/Button";

interface OnboardCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
}

function OnboardCard({
  icon,
  title,
  subtitle,
  selected,
  onClick,
}: OnboardCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[152px] flex-col items-center gap-2.5 rounded-xl px-3.5 pb-[22px] pt-[32px] text-center transition-transform",
        selected
          ? "scale-[0.98] border-[1.5px] border-accent bg-accent/10"
          : "scale-100 border-[1.5px] border-border bg-card",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
    >
      <div className="mb-1 flex h-[52px] w-[52px] items-center justify-center rounded-xl">
        {icon}
      </div>
      <div className="text-[17px] font-bold tracking-tight text-text-primary">
        {title}
      </div>
      <div className="text-[12px] leading-relaxed text-text-secondary">
        {subtitle}
      </div>
    </button>
  );
}

export function OnboardingForm() {
  const router = useRouter();
  const [selected, setSelected] = useState<"yes" | "no" | null>(null);

  const handleSkip = () => {
    router.push("/(main)/landing"); // 임시 라우팅
  };

  const handleChoose = (value: "yes" | "no") => {
    setSelected(value);
    // 선택 후 자동 전환 (280ms 딜레이)
    setTimeout(() => {
      // TODO: 다음 단계로 이동, 임시로 랜딩 페이지로
      router.push("/(main)/landing");
    }, 280);
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* 상단 건너뛰기 */}
      <div className="flex justify-end px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          className="text-[14px] font-medium text-text-secondary"
        >
          건너뛰기
        </Button>
      </div>

      {/* 본문 영역 */}
      <div className="flex flex-1 flex-col px-5 pb-5 pt-3">
        {/* 진행률 바 */}
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-2 rounded-full transition-all duration-250",
                  i === 0 ? "w-6 bg-accent" : "w-2 bg-border"
                )}
              />
            ))}
          </div>
          <span className="ml-auto text-[12px] font-medium text-text-secondary">
            1 / 5
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <h1 className="mb-2 text-balance text-center text-[28px] font-bold tracking-tight text-text-primary">
            걷는 거 좋아하세요?
          </h1>
          <p className="mb-9 text-center text-[14px] text-text-secondary">
            취향에 맞는 코스를 추천해드릴게요
          </p>

          <div className="grid grid-cols-2 gap-3">
            <OnboardCard
              selected={selected === "yes"}
              onClick={() => handleChoose("yes")}
              icon={
                <Footprints
                  size={32}
                  className="text-accent"
                  strokeWidth={1.8}
                />
              }
              title="네"
              subtitle="도보 코스 위주로"
            />
            <OnboardCard
              selected={selected === "no"}
              onClick={() => handleChoose("no")}
              icon={
                <Navigation
                  size={32}
                  className="text-primary"
                  strokeWidth={1.8}
                />
              }
              title="아니요"
              subtitle="이동 최소화로"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
