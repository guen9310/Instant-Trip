// 세션 만료·삭제 등으로 재로그인이 필요할 때 로그인 화면으로 이동시킨다.
// 하드 네비게이션(전체 새로고침)을 써야 Next.js 클라이언트 캐시가 완전히 비워져,
// 로그아웃/세션 만료 후 뒤로가기로 이전(인증된) 화면이 재노출되는 문제를 막을 수 있다.
//
// reason을 쿼리 파라미터로 실어 보내면, 이 호출 시점에 원래 화면이 이미 언마운트됐어도
// (예: 낙관적 이동 이후 비동기로 감지된 세션 만료) 로그인 화면이 그 사유를 읽어
// 안내 배너를 띄울 수 있다 — 컴포넌트 생존 여부와 무관하게 항상 보이는 유일한 방법이다.
export function redirectToSignIn(reason?: "session_expired") {
  const query = reason ? `?reason=${reason}` : "";
  window.location.href = `/sign-in${query}`;
}
