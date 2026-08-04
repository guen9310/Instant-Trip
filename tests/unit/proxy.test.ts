import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function makeRequest(pathname: string, cookies: Record<string, string> = {}) {
  const headers = new Headers();
  const cookieHeader = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return new NextRequest(`https://example.com${pathname}`, { headers });
}

function redirectTarget(res: ReturnType<typeof proxy>) {
  const location = res.headers.get("location");
  return location ? new URL(location) : null;
}

describe("proxy — 인증 게이트 (해피 패스)", () => {
  it("세션 쿠키 없이 보호 경로에 접근하면 reason 없이 /sign-in으로 보낸다", () => {
    const res = proxy(makeRequest("/settings"));
    const target = redirectTarget(res);

    expect(target?.pathname).toBe("/sign-in");
    // 최초 방문/직접 로그아웃 케이스는 "세션 만료"라고 말할 근거가 없다 —
    // reason 쿼리 파라미터가 붙지 않아야 SignInForm의 만료 배너가 뜨지 않는다.
    expect(target?.searchParams.get("reason")).toBeNull();
  });

  it("세션 쿠키가 있으면 보호 경로를 그대로 통과시킨다 (실제 유효성은 페이지가 판단)", () => {
    const res = proxy(
      makeRequest("/settings", { "better-auth.session_token": "abc" }),
    );

    expect(res.headers.get("location")).toBeNull();
  });

  it("__Secure- 접두사 쿠키도 로그인 상태로 인식한다", () => {
    const res = proxy(
      makeRequest("/profile", { "__Secure-better-auth.session_token": "abc" }),
    );

    expect(res.headers.get("location")).toBeNull();
  });

  it("보호 경로가 아니면 쿠키 없이도 통과시킨다", () => {
    const res = proxy(makeRequest("/feed"));

    expect(res.headers.get("location")).toBeNull();
  });
});
