import "@testing-library/jest-dom";
import { beforeAll, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";

import { handlers } from "./handlers";

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

export const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
