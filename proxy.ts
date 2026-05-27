import { NextRequest, NextResponse } from "next/server";

// HTTPS 배포 환경에서 better-auth는 __Secure- 접두사를 자동으로 붙임
const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

const PROTECTED = ["/feed", "/profile", "/settings", "/start", "/course", "/onboarding"];
const AUTH_ONLY = ["/sign-in"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoggedIn = SESSION_COOKIES.some((name) => request.cookies.has(name));

  if (!isLoggedIn && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && AUTH_ONLY.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
