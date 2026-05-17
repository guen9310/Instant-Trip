"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/shared/utils";
import { DEFAULT_PREFS, PREF_META, type Prefs, type PrefKey } from "@/shared/constants/preferences";
import { usePrefsStore } from "@/client/stores/usePrefsStore";

const STEPS: {
  id: PrefKey;
  question: string;
  subtitle: string;
  options: { id: string; title: string; desc: string; iconClass: string; icon: (typeof PREF_META)[PrefKey]["options"][number]["icon"] }[];
}[] = [
  {
    id: "travel",
    question: "걷는 거 좋아하세요?",
    subtitle: "이동 방식에 맞게 코스를 짜드릴게요",
    options: [
      { ...PREF_META.travel.options[0], title: "네", desc: "도보 코스 위주로", iconClass: "text-accent" },
      { ...PREF_META.travel.options[1], title: "아니요", desc: "이동 최소화로", iconClass: "text-primary" },
    ],
  },
  {
    id: "party",
    question: "혼자 여행하시나요?",
    subtitle: "인원에 맞게 장소를 골라드릴게요",
    options: [
      { ...PREF_META.party.options[0], title: "혼자요", desc: "나만의 코스로", iconClass: "text-primary" },
      { ...PREF_META.party.options[1], title: "같이요", desc: "함께하는 코스로", iconClass: "text-accent" },
    ],
  },
  {
    id: "vibe",
    question: "어떤 분위기 좋아하세요?",
    subtitle: "장소 분위기를 취향에 맞게 반영해드려요",
    options: [
      { ...PREF_META.vibe.options[0], title: "조용한 곳", desc: "여유롭고 한적한 공간", iconClass: "text-primary" },
      { ...PREF_META.vibe.options[1], title: "활기찬 곳", desc: "생동감 있는 공간", iconClass: "text-accent" },
    ],
  },
  {
    id: "food",
    question: "맛집이 중요하신가요?",
    subtitle: "식사 장소 추천에 반영해드릴게요",
    options: [
      { ...PREF_META.food.options[0], title: "중요해요", desc: "맛집 위주로", iconClass: "text-accent" },
      { ...PREF_META.food.options[1], title: "상관없어요", desc: "어디든 괜찮아요", iconClass: "text-primary" },
    ],
  },
  {
    id: "indoor",
    question: "실내가 편한가요, 야외가 좋은가요?",
    subtitle: "장소 유형 선정에 반영해드릴게요",
    options: [
      { ...PREF_META.indoor.options[0], title: "실내가 좋아요", desc: "카페, 박물관, 쇼핑몰 위주", iconClass: "text-primary" },
      { ...PREF_META.indoor.options[1], title: "야외가 좋아요", desc: "공원, 거리, 야외 명소 위주", iconClass: "text-accent" },
    ],
  },
];

interface OnboardCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}

function OnboardCard({ icon, title, desc, selected, onClick }: OnboardCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[152px] flex-col items-center gap-2.5 rounded-xl px-3.5 pb-[22px] pt-[32px] text-center transition-transform",
        selected
          ? "scale-[0.98] border-[1.5px] border-accent bg-accent/10"
          : "scale-100 border-[1.5px] border-border bg-card",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      <div className="mb-1 flex h-[52px] w-[52px] items-center justify-center rounded-xl">
        {icon}
      </div>
      <div className="text-[17px] font-bold tracking-tight text-text-primary">
        {title}
      </div>
      <div className="text-[12px] leading-relaxed text-text-secondary">
        {desc}
      </div>
    </button>
  );
}

export function OnboardingForm() {
  const router = useRouter();
  const setPrefs = usePrefsStore((s) => s.setPrefs);
  const [stepIdx, setStepIdx] = useState(0);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Partial<Prefs>>({});

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  const handleBack = () => {
    const prevIdx = stepIdx - 1;
    setStepIdx(prevIdx);
    setSelectedValue(answers[STEPS[prevIdx].id] ?? null);
  };

  const handleChoose = (value: string) => {
    setSelectedValue(value);
    const newAnswers = { ...answers, [step.id]: value };
    setAnswers(newAnswers);
    setTimeout(() => {
      if (isLast) {
        setPrefs({ ...DEFAULT_PREFS, ...newAnswers } as Prefs);
        router.push("/onboarding/done");
      } else {
        setStepIdx((prev) => prev + 1);
        setSelectedValue(null);
      }
    }, 280);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col px-5 pb-5 pt-8">
        {/* 진행률 바 */}
        <div className="mb-8 flex items-center gap-2.5">
          <button
            onClick={handleBack}
            className={cn(
              "w-7 h-7 flex items-center justify-center rounded-full text-text-secondary transition-opacity shrink-0",
              stepIdx === 0 ? "opacity-0 pointer-events-none" : "opacity-100"
            )}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  i === stepIdx
                    ? "w-6 bg-accent"
                    : i < stepIdx
                      ? "w-2 bg-accent/40"
                      : "w-2 bg-border",
                )}
              />
            ))}
          </div>
          <span className="ml-auto text-[12px] font-medium text-text-secondary">
            {stepIdx + 1} / {STEPS.length}
          </span>
        </div>

        {stepIdx === 0 && (
          <p className="text-center text-[15px] text-text-secondary leading-relaxed mb-6">
            한 번만 알려주세요.<br />
            그 다음부턴 그냥 떠나기만 하면 돼요.
          </p>
        )}

        <div className={cn("flex flex-1 flex-col justify-start", stepIdx > 0 && "pt-[18%]")}>
          <h1 className="mb-2 text-balance text-center text-[28px] font-bold tracking-tight text-text-primary">
            {step.question}
          </h1>
          <p className="mb-9 text-center text-[14px] text-text-secondary">
            {step.subtitle}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {step.options.map((opt) => {
              const Icon = opt.icon;
              return (
                <OnboardCard
                  key={opt.id}
                  selected={selectedValue === opt.id}
                  onClick={() => handleChoose(opt.id)}
                  icon={<Icon size={32} className={opt.iconClass} strokeWidth={1.8} />}
                  title={opt.title}
                  desc={opt.desc}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* 하단 건너뛰기 */}
      <div className="pb-[calc(16px+env(safe-area-inset-bottom,8px))] flex justify-center">
        <button
          type="button"
          onClick={() => router.push("/feed")}
          className="py-2 px-4 text-[13px] text-text-secondary"
        >
          건너뛰기
        </button>
      </div>
    </div>
  );
}
