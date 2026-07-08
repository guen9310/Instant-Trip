import { create } from "zustand";
import { DEFAULT_PREFS, type Prefs } from "@/shared/constants/preferences";

// 온보딩 플로우 전용 임시 상태 (DB 저장 전 단계별 선택값 + 완료 화면 요약).
// 취향의 진실의 출처는 DB(user.pref_*)다 — 다른 화면은 서버 컴포넌트에서
// 세션으로 읽어 prop으로 받는다. 이 스토어를 DB 취향의 복제본으로 쓰지 말 것
// (메모리 전용이라 새로고침 시 DEFAULT_PREFS로 리셋됨 — AGENTS.md 5번 안티패턴).

type PrefsStore = {
  prefs: Prefs;
  setPrefs: (prefs: Prefs) => void;
  setPref: (key: keyof Prefs, value: string) => void;
};

export const usePrefsStore = create<PrefsStore>((set) => ({
  prefs: DEFAULT_PREFS,
  setPrefs: (prefs) => set({ prefs }),
  setPref: (key, value) =>
    set((state) => ({ prefs: { ...state.prefs, [key]: value as never } })),
}));
