import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "./auth";

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
