import { DEFAULT_PREFS, type Prefs } from "@/shared/constants/preferences";

// better-auth user의 additional fields 형태 (session.user)
type PrefFields = {
  prefTravel?: string | null;
  prefParty?: string | null;
  prefVibe?: string | null;
  prefFood?: string | null;
  prefIndoor?: string | null;
};

// DB에 저장된 취향(user.pref_*) → Prefs. 취향의 진실의 출처는 DB이며,
// 화면은 서버 컴포넌트에서 이 값을 prop으로 내려받는다 (Zustand 복제 금지 — AGENTS.md 5번).
export function toPrefs(user: PrefFields): Prefs {
  return {
    travel: (user.prefTravel ?? DEFAULT_PREFS.travel) as Prefs["travel"],
    party:  (user.prefParty  ?? DEFAULT_PREFS.party)  as Prefs["party"],
    vibe:   (user.prefVibe   ?? DEFAULT_PREFS.vibe)   as Prefs["vibe"],
    food:   (user.prefFood   ?? DEFAULT_PREFS.food)   as Prefs["food"],
    indoor: (user.prefIndoor ?? DEFAULT_PREFS.indoor) as Prefs["indoor"],
  };
}
