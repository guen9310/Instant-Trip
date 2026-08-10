import "@testing-library/jest-dom";
import { beforeAll, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { MotionGlobalConfig } from "framer-motion";

import { handlers } from "./handlers";

// jsdom엔 Web Animations API가 없어 framer-motion의 AnimatePresence exit 애니메이션이
// 끝났다는 신호(onAnimationComplete)가 영영 오지 않는다 — mode="wait"를 쓰는 컴포넌트는
// 이전 요소가 계속 마운트된 채로 남아 다음 요소가 렌더되지 않고 waitFor가 타임아웃난다.
// skipAnimations는 framer-motion 공식 테스트 권장 설정으로, 모든 트랜지션을 즉시
// 최종 상태로 스킵시켜 애니메이션 타이밍과 무관하게 테스트가 동작하게 한다.
MotionGlobalConfig.skipAnimations = true;

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

// jsdom엔 Pointer Capture API가 없어 vaul(드로어)이 pointerdown에서 TypeError를 던진다
// — 테스트는 통과해도 unhandled error로 vitest가 exit 1이 된다. no-op으로 스텁.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}

// input-otp(내부 useEffect)가 0/10/50ms 타이머 3개를 예약하지만 클린업 함수를
// 반환하지 않아 언마운트 시 정리되지 않는다 — 테스트 종료 후 jsdom window가
// 정리된 시점에 뒤늦게 발동하면 "window is not defined" unhandled error로
// vitest가 간헐적으로 exit 1이 된다. setTimeout/clearTimeout을 계측해 아직
// 발동하지 않은 타이머를 각 테스트 종료·전체 종료 시점에 정리한다
// (어느 컴포넌트가 예약했든 동일하게 적용되는 범용 안전망).
type TimeoutId = ReturnType<typeof setTimeout>;

const pendingTimeouts = new Set<TimeoutId>();
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;

global.setTimeout = ((handler: unknown, timeout?: number, ...args: unknown[]) => {
  if (typeof handler !== "function") {
    return (originalSetTimeout as (...a: unknown[]) => TimeoutId)(
      handler,
      timeout,
      ...args,
    );
  }
  const id = originalSetTimeout(() => {
    pendingTimeouts.delete(id);
    (handler as (...a: unknown[]) => void)(...args);
  }, timeout);
  pendingTimeouts.add(id);
  return id;
}) as typeof setTimeout;

global.clearTimeout = ((id?: TimeoutId) => {
  if (id !== undefined) pendingTimeouts.delete(id);
  return originalClearTimeout(id);
}) as typeof clearTimeout;

function flushPendingTimeouts() {
  pendingTimeouts.forEach((id) => originalClearTimeout(id));
  pendingTimeouts.clear();
}

export const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  flushPendingTimeouts();
});
afterAll(() => {
  server.close();
  flushPendingTimeouts();
});
