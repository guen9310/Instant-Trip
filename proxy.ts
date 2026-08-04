import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAMES } from "@/shared/constants/auth";

const PROTECTED = ["/profile", "/settings", "/start", "/course", "/onboarding"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));

  // 서버 액션(Server Function) 호출은 별도 라우트가 아니라 그 액션이 쓰인 페이지 경로로의
  // POST 요청으로 온다(Next.js 공식 문서). 여기서 리다이렉트를 반환하면 클라이언트의 액션
  // 호출부가 정상 액션 응답 형식을 기대하다가 파싱 에러를 내고, 호출부에 try/catch가 없으면
  // 로딩 상태가 영영 풀리지 않는 무한 로딩으로 이어진다(예: /start의 generateCourseAction).
  // 그래서 액션 요청은 통과시키고, 인증 체크는 각 서버 액션이 getAuthState()/
  // getFreshAuthState()로 직접 하도록 위임한다 — Next.js도 "proxy만 믿지 말고 각 서버
  // 액션 안에서 직접 인증을 검증하라"고 명시한다.
  const isServerAction = request.headers.has("next-action");

  // 쿠키 자체가 없으면 최초 방문이거나 직접 로그아웃한 경우다 — 이 시점엔 세션이
  // "무효화"됐다고 말할 근거가 없으므로 reason 없이 보낸다. 쿠키는 있지만 서버에서
  // 실제로 무효화된 경우(invalid_session)는 DB 조회가 필요해 여기(엣지 이전 단계)서
  // 판별하지 않는다 — 각 보호된 페이지·서버 액션이 getAuthState()/getFreshAuthState()로
  // 정확히 구분한다.
  if (!isServerAction && !hasSessionCookie && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
