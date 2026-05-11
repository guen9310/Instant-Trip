"use client";

import { useEffect } from "react";
import { useDarkModeStore } from "@/client/stores/useDarkModeStore";

export function DarkModeSync() {
  const theme = useDarkModeStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "light") {
      root.classList.remove("dark");
      return;
    }

    if (theme === "dark") {
      root.classList.add("dark");
      return;
    }

    // system: 시스템 설정 따라가기
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    root.classList.toggle("dark", mq.matches);

    const handler = (e: MediaQueryListEvent) =>
      root.classList.toggle("dark", e.matches);

    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return null;
}
