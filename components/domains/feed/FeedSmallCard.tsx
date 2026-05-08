"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import type { CourseData } from "@/shared/types/feed.types";

export function FeedSmallCard({
  course,
  onSelect,
}: {
  course: CourseData;
  onSelect: (course: CourseData) => void;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border bg-surface cursor-pointer select-none p-3 min-h-[92px] flex flex-col justify-between"
      style={{
        transform: pressed ? "scale(0.97)" : "scale(1)",
        transition: "transform .12s ease",
        opacity: course.availability === "unavailable" ? 0.6 : 1,
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onClick={() => onSelect(course)}
    >
      <div className="text-[13px] font-bold text-text-primary tracking-[-0.01em] leading-[1.3]">
        {course.name}
      </div>
      <div>
        <div className="text-[11px] text-muted-foreground mb-1 leading-[1.3]">
          {course.region}
          <br />
          완료 {course.count}명
        </div>
        <div className="font-medium mb-1 h-[13px]">
          {course.availability === "available" && (
            <span className="text-accent text-[10px] ">지금 갈 수 있어요</span>
          )}
          {course.availability === "partial" && (
            <span className="text-muted-foreground text-[10px] ">
              일부 확인 필요
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Star size={10} strokeWidth={1.5} className="fill-point text-point" />
          <span className="text-[11px] font-semibold text-text-primary tabular-nums">
            {course.rating}
          </span>
        </div>
      </div>
    </div>
  );
}
