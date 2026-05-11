"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Star } from "lucide-react";
import { cn } from "@/shared/utils";
import { Button } from "@/components/commons/Button";
import { Textarea } from "@/components/commons/Textarea";

export function CourseDoneView() {
  const [stars, setStars] = useState(4);
  const [review, setReview] = useState("");
  const router = useRouter();

  const handleDone = () => {
    router.push("/feed");
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4">
        {/* 완료 헤더 */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-accent/9 text-accent flex items-center justify-center mx-auto mb-3.5">
            <CheckCircle size={32} strokeWidth={2.2} />
          </div>
          <h1 className="text-[24px] font-bold text-text-primary tracking-tight mb-1.5">
            3시간 코스 완료!
          </h1>
          <p className="text-[14px] text-text-secondary">어떠셨나요?</p>
        </div>

        {/* XP 카드 */}
        <div className="p-4 rounded-xl border border-border bg-gradient-to-br from-primary/5 to-accent/9 mb-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[14px] text-text-primary font-medium">
              코스 완료
            </span>
            <span className="text-[14px] font-bold text-point">+30 XP</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[14px] text-text-primary font-medium">
              첫 서울 종로 방문
            </span>
            <span className="text-[14px] font-bold text-point">+10 XP</span>
          </div>
          <div className="h-px bg-border my-3.5" />
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[13px] font-semibold text-text-primary">
              탐험가 Lv.3
            </span>
            <span className="text-[12px] text-text-secondary tabular-nums">
              340 / 500 XP
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div className="w-[68%] h-full rounded-full bg-primary" />
          </div>
        </div>

        {/* 별점 */}
        <div className="mb-4">
          <p className="text-[13px] font-semibold text-text-secondary mb-2.5">
            별점
          </p>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} onClick={() => setStars(i)} className="p-1">
                <Star
                  size={32}
                  strokeWidth={1.5}
                  className={cn(
                    i <= stars
                      ? "text-point fill-point"
                      : "text-border fill-transparent",
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {/* 후기 입력 */}
        <Textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="한줄 후기 (선택) — 남기면 +5 XP"
          className="min-h-[88px] resize-none"
        />
      </div>

      {/* CTA 바 */}
      <div className="border-t border-border bg-background px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,8px))] flex flex-col gap-2">
        <Button size="cta" onClick={handleDone}>
          후기 남기고 +5 XP
        </Button>
        <button
          onClick={handleDone}
          className="w-full h-12 text-[15px] font-medium text-text-primary flex items-center justify-center"
        >
          그냥 넘기기
        </button>
      </div>
    </>
  );
}
