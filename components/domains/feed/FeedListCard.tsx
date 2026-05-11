"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import type { CourseData } from "@/shared/types/feed.types";

export function FeedListCard({
  course,
  onSelect,
}: {
  course: CourseData;
  onSelect: (course: CourseData) => void;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <div
      className="flex items-center gap-3 py-3 border-b border-border cursor-pointer select-none"
      style={{
        transform: pressed ? "scale(0.99)" : "scale(1)",
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://picsum.photos/seed/${course.id}/68/68`}
        alt={course.name}
        className="w-[68px] h-[68px] rounded-xl object-cover bg-surface-secondary shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-text-primary tracking-[-0.01em] truncate mb-0.5">
          {course.name}
        </p>
        <p className="text-[12px] text-text-secondary mb-1.5">
          {course.region}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            <Star
              size={11}
              strokeWidth={1.5}
              className="fill-point text-point"
            />
            <span className="text-[12px] font-semibold text-text-primary tabular-nums">
              {course.rating}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            완료 {course.count}명
          </span>
          {course.availability === "available" && (
            <span className="text-[11px] text-accent font-medium">
              지금 가능
            </span>
          )}
          {course.availability === "partial" && (
            <span className="text-[11px] text-muted-foreground">
              일부 확인 필요
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
