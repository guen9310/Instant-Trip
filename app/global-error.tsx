"use client"; // 에러 바운더리는 Client Component여야 한다 (Next.js 요구사항)

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/commons/Button";
import "./globals.css";

// app/error.tsx는 app/layout.tsx(루트 레이아웃) 자신이 던지는 예외는 잡지 못한다
// (error.js는 같은 세그먼트의 layout.js를 감싸지 않음 — Next.js 공식 문서). 루트
// 레이아웃은 getSession() 같은 위험한 비동기 호출이 없어 실제 발생 가능성은 낮지만,
// 전역 안전망을 완전하게 두기 위해 최후 방어선으로 추가했다. global-error는 루트
// 레이아웃 자체를 대체하므로 <html>/<body>를 직접 정의해야 하고(Next.js 요구사항),
// next/font 등 루트 레이아웃이 의존하던 것과 동일한 실패 경로를 다시 타지 않도록
// 시스템 폰트만 사용한다.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[app/global-error] 루트 레이아웃 예외", error);
  }, [error]);

  return (
    <html lang="ko">
      <body className="h-dvh flex items-center justify-center bg-background text-text-primary">
        <div className="flex flex-col items-center px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-point/12 flex items-center justify-center mb-4">
            <AlertTriangle size={26} className="text-point" strokeWidth={2} />
          </div>
          <p className="text-[16px] font-bold tracking-tight mb-1.5">
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
      </body>
    </html>
  );
}
