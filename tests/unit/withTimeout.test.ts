import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTimeout, TimeoutError } from "@/shared/utils/withTimeout";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("제한 시간 안에 resolve되면 원래 값을 그대로 반환한다", async () => {
    const promise = withTimeout(Promise.resolve("정상 응답"), 1000);
    await vi.advanceTimersByTimeAsync(0);
    await expect(promise).resolves.toBe("정상 응답");
  });

  it("제한 시간 안에 reject되면 원래 에러를 그대로 전파한다", async () => {
    // Promise.reject(...)를 인자로 바로 넘기면 withTimeout이 핸들러를 붙이기 전
    // 찰나에 "unhandled"로 잡혀 테스트가 경고를 낸다 — reject를 한 틱 늦춰 피한다.
    const originalError = new Error("서버 에러");
    let rejectOriginal: (err: Error) => void;
    const original = new Promise<never>((_, reject) => {
      rejectOriginal = reject;
    });
    const promise = withTimeout(original, 1000);
    const assertion = expect(promise).rejects.toBe(originalError);
    rejectOriginal!(originalError);
    await assertion;
  });

  it("원본 promise가 resolve도 reject도 하지 않으면(hang) 제한 시간 후 TimeoutError로 reject한다", async () => {
    const neverSettles = new Promise(() => {});
    const promise = withTimeout(neverSettles, 1000);

    const assertion = expect(promise).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("제한 시간 전에 원본이 resolve되면 그 시점에 즉시 settle된다(타임아웃까지 기다리지 않는다)", async () => {
    let resolveOriginal: (value: string) => void;
    const original = new Promise<string>((resolve) => {
      resolveOriginal = resolve;
    });
    const promise = withTimeout(original, 1000);

    await vi.advanceTimersByTimeAsync(500);
    resolveOriginal!("늦지만 제한 시간 안");
    await vi.advanceTimersByTimeAsync(0);

    await expect(promise).resolves.toBe("늦지만 제한 시간 안");
  });
});
