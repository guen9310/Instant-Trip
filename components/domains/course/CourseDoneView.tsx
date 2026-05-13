"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Star } from "lucide-react";
import { cn } from "@/shared/utils";
import { Button } from "@/components/commons/Button";
import { Textarea } from "@/components/commons/Textarea";
import { MOCK_PLACES } from "@/shared/constants/courseMock";

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

        {/* 방문 장소 요약 */}
        <div className="rounded-xl border border-border bg-card mb-5 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[12px] font-semibold text-text-secondary">
              오늘 다녀온 곳
            </p>
          </div>
          {MOCK_PLACES.map((place, i) => (
            <div
              key={place.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                i < MOCK_PLACES.length - 1 ? "border-b border-border" : "",
              )}
            >
              <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-text-primary truncate">
                  {place.name}
                </p>
                <p className="text-[11px] text-text-secondary">
                  {place.cat} · {place.dur}
                </p>
              </div>
            </div>
          ))}
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
          placeholder="한줄 후기 (선택)"
          className="min-h-[88px] resize-none"
        />
      </div>

      {/* CTA 바 */}
      <div className="border-t border-border bg-background px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,8px))] flex flex-col gap-2">
        <Button size="cta" onClick={handleDone}>
          후기 남기기
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
