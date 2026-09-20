import { Star } from "lucide-react";
import { cn } from "@/shared/utils";

export function StarRating({ rating }: { rating: number }) {
  return (
    // 읽기 전용 별점 — 아이콘 5개 대신 "별점 N점" 한 번만 읽히게 한다.
    <div className="flex gap-0.5" role="img" aria-label={`별점 ${rating}점`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={13}
          strokeWidth={1.5}
          className={cn(
            s <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-border",
          )}
        />
      ))}
    </div>
  );
}
