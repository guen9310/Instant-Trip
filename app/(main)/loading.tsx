import { Loader2 } from "lucide-react";

// (main) 그룹 하위 page.tsx가 데이터를 페칭하는 동안 보여줄 fallback UI.
// Next.js가 page.tsx(및 그 아래 nested layout)만 Suspense로 감싸고 MainLayout
// 자신(getSession 호출부)은 감싸지 않으므로, 세션 조회 자체가 이 스피너로 가려지진
// 않는다 — 그건 정상 동작이며 layout.tsx Caveats 문서에 명시돼 있다. 다른 화면에서
// 이미 쓰는 Loader2 + animate-spin 패턴(HomeLocationCard, StartView 등)을 재사용했다.
export default function MainLoading() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 size={28} className="text-primary animate-spin" strokeWidth={2} />
    </div>
  );
}
