import { NextRequest, NextResponse } from "next/server";

// HTTPS 배포 환경에서 better-auth는 __Secure- 접두사를 자동으로 붙임
const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

const PROTECTED = ["/profile", "/settings", "/start", "/course", "/onboarding"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoggedIn = SESSION_COOKIES.some((name) => request.cookies.has(name));

  if (!isLoggedIn && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    // 로그인한 적 없는 사용자가 보호된 URL로 바로 들어온 경우도 포함해 무조건 붙인다 —
    // 두 경우를 쿠키 유무만으로는 구분할 수 없고, 어느 쪽이든 실질적으로는 "로그인이
    // 필요하다"는 같은 상황이라 문구가 약간 부정확해도 감수하기로 했다(SignInForm 참고).
    url.searchParams.set("reason", "session_expired");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
