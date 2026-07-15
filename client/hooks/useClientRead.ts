"use client";

import { useRef, useSyncExternalStore } from "react";

// 하이드레이션 이전(서버 스냅샷) 렌더를 나타내는 센티널
export const HYDRATING = Symbol("hydrating");

// 1회 읽기라 구독할 변화가 없다 — 참조 안정성을 위해 모듈 레벨 상수
const subscribeNoop = () => () => {};

// SSR 안전한 브라우저 저장소(localStorage 등) 1회 읽기.
// 서버·하이드레이션 렌더에서는 HYDRATING을, 클라이언트에서는 read() 결과를 반환한다.
// 효과 안에서 setState로 초기값을 밀어넣는 대신 외부 시스템 읽기를 선언적으로 처리한다.
// getSnapshot은 렌더마다 같은 참조를 돌려줘야 하므로 최초 1회만 read()를 호출해 캐시한다.
export function useClientRead<T>(read: () => T): T | typeof HYDRATING {
  const cache = useRef<{ value: T } | null>(null);
  return useSyncExternalStore<T | typeof HYDRATING>(
    subscribeNoop,
    () => {
      if (cache.current === null) cache.current = { value: read() };
      return cache.current.value;
    },
    () => HYDRATING,
  );
}
