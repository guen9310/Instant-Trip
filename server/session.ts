import { cookies, headers } from "next/headers";
import { cache } from "react";
import { auth } from "./auth";
import type { Session } from "./auth";
import { SESSION_COOKIE_NAMES } from "@/shared/constants/auth";

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

// DB 쓰기·개인정보 조회 등 민감한 지점 전용. 쿠키 캐시를 건너뛰고
// 매번 DB에서 세션을 재검증한다. 일반 화면 진입 판정에는 getSession을 쓸 것.
export const getFreshSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
});

export type AuthState =
  | { status: "authenticated"; session: Session }
  | { status: "anonymous" }
  | { status: "invalid_session" };

// session이 null인 이유는 "한 번도 로그인한 적 없음(anonymous, 직접 로그아웃 포함)"과
// "로그인했던 세션이 서버에서 무효화됨(invalid_session: 만료·삭제·강제 로그아웃)" 두 가지가
// 있는데, `Session | null`만으로는 둘을 구분할 수 없다. 세션 쿠키 존재 여부를 추가 신호로
// 써서 구분한다 — 쿠키가 있는데도 세션이 없으면 무효화된 것이다.
async function resolveAuthState(session: Session | null): Promise<AuthState> {
  if (session) return { status: "authenticated", session };

  const store = await cookies();
  const hadSessionCookie = SESSION_COOKIE_NAMES.some((name) => store.has(name));
  return hadSessionCookie ? { status: "invalid_session" } : { status: "anonymous" };
}

// 일반 화면 진입 판정용 — getSession()과 동일하게 쿠키 캐시를 사용한다(최대 5분 stale
// 허용). anonymous/invalid_session 분기가 필요 없다면 그냥 getSession()을 쓸 것.
export const getAuthState = cache(async (): Promise<AuthState> => {
  return resolveAuthState(await getSession());
});

// DB 쓰기·개인정보 조회 등 민감한 지점 전용 — getFreshSession()과 동일하게 쿠키 캐시를
// 건너뛰고 매번 DB에서 재검증한다. 일반 화면 진입 판정에는 getAuthState를 쓸 것.
export const getFreshAuthState = cache(async (): Promise<AuthState> => {
  return resolveAuthState(await getFreshSession());
});
