export type User = {
  name: string;
  email: string;
  image?: string | null;
  onboardingDone?: boolean | null;
};

// 서버 액션이 인증 실패를 보고할 때 쓰는 사유.
// "anonymous" — 로그인한 적 없음(또는 직접 로그아웃): 안내 없이 조용히 로그인 화면으로 보낸다.
// "invalid_session" — 한때 유효했던 세션이 서버에서 무효화됨(만료·삭제 등): 로그인 화면에
// "세션이 만료됐어요" 배너를 띄운다. server/session.ts의 AuthState와 값이 대응한다.
export type AuthFailureReason = "anonymous" | "invalid_session";
