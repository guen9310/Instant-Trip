"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/shared/utils";
import { Button } from "@/components/commons/Button";
import { PREF_KEYS, PREF_META } from "@/shared/constants/preferences";
import { usePrefsStore } from "@/client/stores/usePrefsStore";

const OPTION_TITLES: Record<string, string> = {
  walk: "걷는 게 좋아요",
  min: "이동 최소화",
  solo: "혼자 여행해요",
  group: "같이 다녀요",
  quiet: "조용한 곳",
  lively: "활기찬 곳",
  matjip: "맛집이 중요해요",
  any: "상관없어요",
  indoor: "실내가 좋아요",
  outdoor: "야외가 좋아요",
};

export function SettingsView() {
  const router = useRouter();
  const prefs = usePrefsStore((s) => s.prefs);
  const setPref = usePrefsStore((s) => s.setPref);

  return (
    <>
      <div className="flex flex-1 flex-col px-4 pt-4 pb-4">
        <p className="text-[13px] text-text-secondary leading-normal mb-4">
          설정한 취향을 바탕으로 코스를 추천해드려요. 언제든지 변경할 수 있어요.
        </p>

        <div className="flex flex-1 flex-col">
          {PREF_KEYS.map((key, si) => {
            const section = PREF_META[key];
            const isLast = si === PREF_KEYS.length - 1;
            return (
              <div
                key={key}
                className={cn(
                  "flex flex-1 flex-col py-3",
                  !isLast && "border-b border-border",
                )}
              >
                <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.04em] mb-2">
                  {section.label}
                </p>

                <div className="flex flex-1 gap-2">
                  {section.options.map((opt) => {
                    const sel = prefs[key] === opt.id;
                    const Ico = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setPref(key, opt.id)}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-2.5 px-3.5 rounded-xl border-[1.5px] transition-all",
                          sel
                            ? "bg-primary/5 border-primary text-primary scale-[0.98]"
                            : "bg-surface border-border text-text-primary",
                        )}
                      >
                        <Ico size={18} strokeWidth={1.8} className="shrink-0" />
                        <span className="text-[13px] font-semibold tracking-tight leading-snug">
                          {OPTION_TITLES[opt.id]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA 바 */}
      <div className="border-t border-border bg-background px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,8px))] flex flex-col gap-2">
        <Button size="cta" onClick={() => router.push("/profile")}>
          저장하기
        </Button>
        <button className="w-full py-3 text-[13px] text-text-secondary flex items-center justify-center">
          로그아웃
        </button>
      </div>
    </>
  );
}
