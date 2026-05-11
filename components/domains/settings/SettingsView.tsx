"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Footprints,
  Navigation,
  User,
  Users,
  Volume1,
  Zap,
  UtensilsCrossed,
  Minus,
  MapPin,
  Map,
} from "lucide-react";
import type { ElementType } from "react";
import { cn } from "@/shared/utils";
import { Button } from "@/components/commons/Button";

type Prefs = {
  travel: "walk" | "min";
  party: "solo" | "group";
  vibe: "quiet" | "lively";
  food: "matjip" | "any";
  radius: "near" | "far";
};

const SECTIONS: {
  key: keyof Prefs;
  label: string;
  options: { id: string; icon: ElementType; title: string }[];
}[] = [
  {
    key: "travel",
    label: "이동 방식",
    options: [
      { id: "walk", icon: Footprints, title: "걷는 게 좋아요" },
      { id: "min", icon: Navigation, title: "이동 최소화" },
    ],
  },
  {
    key: "party",
    label: "여행 인원",
    options: [
      { id: "solo", icon: User, title: "혼자 여행해요" },
      { id: "group", icon: Users, title: "같이 다녀요" },
    ],
  },
  {
    key: "vibe",
    label: "장소 분위기",
    options: [
      { id: "quiet", icon: Volume1, title: "조용한 곳" },
      { id: "lively", icon: Zap, title: "활기찬 곳" },
    ],
  },
  {
    key: "food",
    label: "먹거리",
    options: [
      { id: "matjip", icon: UtensilsCrossed, title: "맛집이 중요해요" },
      { id: "any", icon: Minus, title: "상관없어요" },
    ],
  },
  {
    key: "radius",
    label: "이동 반경",
    options: [
      { id: "near", icon: MapPin, title: "가까운 곳만" },
      { id: "far", icon: Map, title: "멀리도 괜찮아요" },
    ],
  },
];

const DEFAULT_PREFS: Prefs = {
  travel: "walk",
  party: "solo",
  vibe: "quiet",
  food: "matjip",
  radius: "near",
};

export function SettingsView() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const router = useRouter();

  const setPref = (key: keyof Prefs, value: string) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        <p className="text-[13px] text-text-secondary leading-[1.5] mb-6">
          설정한 취향을 바탕으로 코스를 추천해드려요. 언제든지 변경할 수 있어요.
        </p>

        {SECTIONS.map((section, si) => {
          const isLast = si === SECTIONS.length - 1;
          return (
            <div key={section.key} className={isLast ? "mb-2" : "mb-6"}>
              <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-[0.04em] mb-2.5">
                {section.label}
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                {section.options.map((opt) => {
                  const sel = prefs[section.key] === opt.id;
                  const Ico = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setPref(section.key, opt.id)}
                      className={cn(
                        "flex flex-col items-center gap-2.5 py-[18px] px-3.5 rounded-xl border-[1.5px] min-h-[110px] justify-center transition-all",
                        sel
                          ? "bg-primary/5 border-primary text-primary scale-[0.98]"
                          : "bg-surface border-border text-text-primary"
                      )}
                    >
                      <Ico size={26} strokeWidth={1.8} />
                      <span className="text-[14px] font-semibold tracking-tight text-center leading-snug">
                        {opt.title}
                      </span>
                    </button>
                  );
                })}
              </div>

              {!isLast && <div className="h-px bg-border mt-6" />}
            </div>
          );
        })}
      </div>

      {/* CTA 바 */}
      <div className="border-t border-border bg-background px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,8px))] flex flex-col gap-2">
        <Button size="cta" onClick={() => router.push("/profile")}>
          저장하기
        </Button>
        <button
          onClick={() => router.push("/onboarding")}
          className="w-full h-12 text-[15px] font-medium text-text-primary flex items-center justify-center"
        >
          온보딩 다시 하기
        </button>
      </div>
    </>
  );
}
