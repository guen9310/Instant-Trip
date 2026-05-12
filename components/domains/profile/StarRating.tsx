import { Star } from "lucide-react";
import { cn } from "@/shared/utils";

export function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
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
