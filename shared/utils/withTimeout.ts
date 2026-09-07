// Next.js 서버 액션 호출은 우리가 fetch를 직접 다루지 않아 AbortSignal을 넘길 수
// 없다. 그런데 그 내부 구현(server-action-reducer.js)의 fetch 자체엔 타임아웃이
// 없어서, 네트워크가 즉시 거부가 아니라 응답 없이 멈추는 방식으로 끊기면(TCP hang)
// 서버 액션 호출이 reject조차 되지 않고 영원히 pending 상태로 남는다 — try/catch는
// promise가 reject될 때만 개입하므로 이 경우엔 무력하다.
//
// withTimeout은 그런 "resolve도 reject도 안 되는" 호출을 감싸, ms 이후 강제로
// reject시켜 호출부의 catch가 반드시 개입할 기회를 만든다.
export class TimeoutError extends Error {
  constructor(message = "요청 시간이 초과됐어요.") {
    super(message);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
