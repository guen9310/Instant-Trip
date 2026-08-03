"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/shared/utils";
import { Button } from "@/components/commons/Button";
import { PREF_KEYS, PREF_META, type Prefs } from "@/shared/constants/preferences";
import { authClient } from "@/client/auth-client";
import { redirectToSignIn } from "@/client/redirectToSignIn";

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

export function SettingsView({ initialPrefs }: { initialPrefs: Prefs }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [prefs, setLocalPrefs] = useState(initialPrefs);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaveError(null);
    try {
      // DB가 취향의 진실의 출처 — 화면들은 서버 컴포넌트에서 세션으로 읽으므로
      // 클라이언트 스토어 동기화가 필요 없다
      const { error } = await authClient.updateUser({
        prefTravel: prefs.travel,
        prefParty:  prefs.party,
        prefVibe:   prefs.vibe,
        prefFood:   prefs.food,
        prefIndoor: prefs.indoor,
      });

      if (!error) {
        router.push("/profile");
        return;
      }

      // 세션이 DB에서 무효화된 상태(유저 삭제 등) — 일반 저장 실패와 구분해
      // 로컬 상태를 정리하고 로그인 화면으로 보낸다. 안내 문구는 이 화면이 아니라
      // 로그인 화면에서 보여준다 — 여기서 setSaveError로 띄워도 곧바로 리다이렉트가
      // 실행돼 사용자가 볼 틈이 없다.
      if (error.status === 401) {
        queryClient.clear();
        redirectToSignIn("session_expired");
        return;
      }

      setSaveError("저장에 실패했어요. 다시 시도해 주세요.");
    } catch {
      // authClient.updateUser는 정상적으로는 throw하지 않고 {data,error}를
      // 반환하지만, 네트워크 단절 등 fetch 자체가 실패하는 경우를 대비한 최후 방어선.
      setSaveError("저장에 실패했어요. 다시 시도해 주세요.");
    }
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    queryClient.clear();
    // router.push(소프트 네비게이션)는 방문했던 페이지의 클라이언트 캐시를 그대로
    // 남긴다 — 로그아웃 후 뒤로가기를 누르면 서버 재검증 없이 그 캐시가 재사용돼
    // 로그인 화면이 다시 보이는 문제가 있었다. 하드 네비게이션으로 캐시를 통째로
    // 비운다(Next.js 공식 문서: 클라이언트 캐시는 페이지 새로고침 시에만 비워짐).
    window.location.href = "/sign-in";
  };

  return (
    <>
      <div className="flex flex-1 flex-col px-4 pt-4 pb-4">
        <p className="text-[13px] text-text-secondary leading-normal mb-4">
          설정한 취향을 바탕으로 갈 곳을 추천해드려요. 언제든지 변경할 수 있어요.
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
                        onClick={() => setLocalPrefs((p) => ({ ...p, [key]: opt.id }))}
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
        {saveError && (
          <p className="text-center text-[12px] text-red-500">{saveError}</p>
        )}
        <Button size="cta" onClick={handleSave}>
          저장하기
        </Button>
        <button
          onClick={handleSignOut}
          className="w-full py-3 text-[13px] text-text-secondary flex items-center justify-center"
        >
          로그아웃
        </button>
      </div>
    </>
  );
}
