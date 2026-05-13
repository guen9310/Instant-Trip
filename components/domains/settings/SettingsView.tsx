"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/shared/utils";
import { Button } from "@/components/commons/Button";
import { PREF_KEYS, PREF_META, DEFAULT_PREFS, type Prefs } from "@/shared/constants/preferences";

const OPTION_TITLES: Record<string, string> = {
  walk: "걷는 게 좋아요",
  min: "이동 최소화",
  solo: "혼자 여행해요",
  group: "같이 다녀요",
  quiet: "조용한 곳",
  lively: "활기찬 곳",
  matjip: "맛집이 중요해요",
  any: "상관없어요",
  near: "가까운 곳만",
  far: "멀리도 괜찮아요",
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
        <p className="text-[13px] text-text-secondary leading-normal mb-6">
          설정한 취향을 바탕으로 코스를 추천해드려요. 언제든지 변경할 수 있어요.
        </p>

        {PREF_KEYS.map((key, si) => {
          const section = PREF_META[key];
          const isLast = si === PREF_KEYS.length - 1;
          return (
            <div key={key} className={isLast ? "mb-2" : "mb-6"}>
              <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-[0.04em] mb-2.5">
                {section.label}
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                {section.options.map((opt) => {
                  const sel = prefs[key] === opt.id;
                  const Ico = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setPref(key, opt.id)}
                      className={cn(
                        "flex flex-col items-center gap-2.5 py-[18px] px-3.5 rounded-xl border-[1.5px] min-h-[110px] justify-center transition-all",
                        sel
                          ? "bg-primary/5 border-primary text-primary scale-[0.98]"
                          : "bg-surface border-border text-text-primary"
                      )}
                    >
                      <Ico size={26} strokeWidth={1.8} />
                      <span className="text-[14px] font-semibold tracking-tight text-center leading-snug">
                        {OPTION_TITLES[opt.id]}
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
          취향 처음부터 다시 설정하기
        </button>
      </div>
    </>
  );
}
