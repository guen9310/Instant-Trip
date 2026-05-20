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

export const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
