"use client"; // 에러 바운더리는 Client Component여야 한다 (Next.js 요구사항)

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/commons/Button";

// app/ 루트에 위치하므로 그 아래 중첩된 layout.tsx(예: app/(main)/layout.tsx)와
// page.tsx에서 발생하는 예외를 모두 잡는 앱 전체 안전망이다. error.tsx는 같은
// 세그먼트의 layout.tsx 자신은 감싸지 못하고 "부모" 세그먼트에 있어야 그 layout의
// 에러를 잡을 수 있으므로(Next.js 공식 문서), (main) 그룹 전용 error.tsx가 아니라
// 여기 app/error.tsx에 둬야 MainLayout의 getSession() 실패 같은 예외까지 잡힌다.
// (app/layout.tsx 자신이 던지는 예외는 이 파일도 못 잡는다 — 그건 global-error.tsx 몫)
export default function GlobalErrorBoundary({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[app/error] 처리되지 않은 예외", error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-point/12 flex items-center justify-center mb-4">
        <AlertTriangle size={26} className="text-point" strokeWidth={2} />
      </div>
      <p className="text-[16px] font-bold text-text-primary tracking-tight mb-1.5">
        일시적인 문제가 발생했어요
      </p>
      <p className="text-[13px] text-text-secondary leading-[1.5] mb-7">
        잠시 후 다시 시도해주세요
      </p>
      <Button
        variant="point"
        size="cta"
        className="max-w-64"
        onClick={() => unstable_retry()}
      >
        <RefreshCw size={15} strokeWidth={2} className="mr-1.5" />
        다시 시도
      </Button>
    </div>
  );
}
