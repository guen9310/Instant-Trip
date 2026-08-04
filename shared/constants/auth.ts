// better-auth 세션 쿠키 이름 — HTTPS 배포 환경에서는 __Secure- 접두사가 자동으로 붙는다.
// proxy.ts(엣지 이전 단계의 쿠키 존재 확인)와 server/session.ts(anonymous/invalid_session
// 판별)가 동일한 목록을 공유해야 하므로 여기 하나로 둔다.
export const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
] as const;
