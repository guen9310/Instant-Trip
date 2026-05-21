"use client";

import { useState } from "react";
import type { FeedCourse } from "@/shared/types/feed.types";
import { generateContextLabel } from "@/shared/utils/feedContext";

export function FeedListCard({
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
      className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer select-none"
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
        {contextLabel ? (
          <p className="text-[12px] text-text-secondary truncate">{contextLabel}</p>
        ) : course.todayCompletions && course.todayCompletions.count > 0 ? (
          <p className="text-[12px] text-text-secondary">
            오늘 {course.todayCompletions.count}명이 완료했어요
          </p>
        ) : (
          <p className="text-[12px] text-text-secondary">{course.region}</p>
        )}
      </div>
      {course.availability === "available" && (
        <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
      )}
    </div>
  );
}
