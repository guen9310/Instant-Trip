// layout.tsx가 beforeInteractive로 넣는 카카오 지도 SDK가 실제로 로드됐는지 — 광고 차단·네트워크
// 오류·도메인 미등록 등으로 스크립트가 실패하면 window.kakao가 없다. beforeInteractive라
// 하이드레이션 이후엔 로드 성공/실패가 이미 확정돼 있어 1회 읽기로 충분하다(useClientRead와 함께 쓴다).
export function isKakaoSdkAvailable(): boolean {
  const win = window as unknown as { kakao?: { maps?: { load?: unknown } } };
  return typeof win.kakao?.maps?.load === "function";
}
