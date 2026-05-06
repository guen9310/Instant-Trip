"use client";

import { useState } from "react";
import { Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/commons/Button";
import { Input } from "@/components/commons/Input";
import { cn } from "@/shared/utils";
import { useRouter } from "next/navigation";

export function SignInForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 인증 코드 발송 처리
    router.push("/sign-in/verify");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
      {/* 본문 영역 — 수직 중앙 정렬 */}
      <div className="flex flex-1 flex-col justify-center px-5 py-10">
        {/* 앱 아이콘 */}
        <div
          className={cn(
            "mb-5 flex h-14 w-14 items-center justify-center rounded-2xl",
            "bg-primary/10 text-primary",
          )}
        >
          <Sparkles size={26} strokeWidth={2.2} />
        </div>

        {/* 헤딩 */}
        <h1 className="mb-2 text-[26px] font-bold tracking-tight text-text-primary">
          시작하기
        </h1>
        <p className="mb-7 text-[14px] leading-relaxed text-text-secondary">
          이메일로 인증 코드를 보내드릴게요
        </p>

        {/* 이메일 입력 */}
        <label
          htmlFor="email"
          className="mb-1.5 text-[12px] font-semibold text-text-secondary"
        >
          이메일
        </label>
        <div
          className={cn(
            "flex h-[52px] items-center gap-2 rounded-[8px] px-3.5",
            "border border-border bg-card",
            "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
            "transition-all duration-150",
          )}
        >
          <Mail size={18} className="shrink-0 text-text-secondary" />
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
            required
            className={cn(
              "h-full flex-1 border-none bg-transparent p-0 text-[15px] text-text-primary",
              "placeholder:text-text-secondary/60",
              "focus-visible:ring-0 focus-visible:border-none",
            )}
          />
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-text-secondary">
          처음이어도 괜찮아요. 계정이 없으면 자동으로 만들어드려요.
        </p>
      </div>

      {/* Fixed CTA 영역 — design.md Fixed CTA 규칙 준수 */}
      <div
        className={cn(
          "border-t border-border bg-background",
          "px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4",
        )}
      >
        <Button type="submit" size="cta" disabled={!email.trim()}>
          인증 코드 받기
        </Button>
      </div>
    </form>
  );
}
