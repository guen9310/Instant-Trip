import { create } from "zustand";
import { DEFAULT_PREFS, type Prefs } from "@/shared/constants/preferences";

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
