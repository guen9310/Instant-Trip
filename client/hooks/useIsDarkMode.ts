"use client";

import { useSyncExternalStore } from "react";

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function subscribe(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

// DarkModeSync가 <html>에 최종 반영한 .dark 클래스를 그대로 구독한다 — useDarkModeStore의
// theme 값만으로는 "system" 설정일 때 실제 적용 여부를 알 수 없어(matchMedia 재확인이
// 필요) DarkModeSync가 이미 끝낸 판단을 다시 구현하기보다, 그 결과인 DOM 상태를 신뢰한다.
export function useIsDarkMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
