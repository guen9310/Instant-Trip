import { NextRequest, NextResponse } from "next/server"

const SESSION_COOKIE = "better-auth.session_token"

// 로그인 필요
const PROTECTED = ["/feed", "/profile", "/settings", "/start", "/course", "/onboarding"]
// 이미 로그인 상태면 넘어갈 필요 없는 페이지
const AUTH_ONLY = ["/sign-in"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isLoggedIn = request.cookies.has(SESSION_COOKIE)

  if (!isLoggedIn && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = "/sign-in"
    return NextResponse.redirect(url)
  }

  if (isLoggedIn && AUTH_ONLY.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = "/feed"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
}
