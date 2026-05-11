import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

const CYCLE: Theme[] = ["light", "dark", "system"];

type DarkModeStore = {
  theme: Theme;
  cycleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

export const useDarkModeStore = create<DarkModeStore>()(
  persist(
    (set) => ({
      theme: "system",
      cycleTheme: () =>
        set((s) => ({
          theme: CYCLE[(CYCLE.indexOf(s.theme) + 1) % CYCLE.length],
        })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "theme" }
  )
);
