import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAMES } from "@/shared/constants/auth";

const PROTECTED = ["/profile", "/settings", "/start", "/course", "/onboarding"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));

  // 쿠키 자체가 없으면 최초 방문이거나 직접 로그아웃한 경우다 — 이 시점엔 세션이
  // "무효화"됐다고 말할 근거가 없으므로 reason 없이 보낸다. 쿠키는 있지만 서버에서
  // 실제로 무효화된 경우(invalid_session)는 DB 조회가 필요해 여기(엣지 이전 단계)서
  // 판별하지 않는다 — 각 보호된 페이지·서버 액션이 getAuthState()/getFreshAuthState()로
  // 정확히 구분한다.
  if (!hasSessionCookie && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
