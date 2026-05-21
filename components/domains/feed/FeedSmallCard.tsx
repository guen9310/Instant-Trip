"use client";

import { useState } from "react";
import type { FeedCourse } from "@/shared/types/feed.types";
import { generateContextLabel } from "@/shared/utils/feedContext";

export function FeedSmallCard({
  course,
  onSelect,
}: {
  course: FeedCourse;
  onSelect: (course: FeedCourse) => void;
}) {
  const [pressed, setPressed] = useState(false);
  const contextLabel = generateContextLabel(course, new Date().getHours());

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
        </div>
        <div className="font-medium mb-1 h-[13px]">
          {course.availability === "available" && (
            <span className="text-accent text-[10px] ">지금 갈 수 있어요</span>
          )}
        </div>
        {contextLabel ? (
          <div className="text-[10px] text-muted-foreground">{contextLabel}</div>
        ) : course.todayCompletions && course.todayCompletions.count > 0 ? (
          <div className="text-[10px] text-muted-foreground">오늘 {course.todayCompletions.count}명이 완료했어요</div>
        ) : null}
      </div>
    </div>
  );
}
