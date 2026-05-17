"use client";

import { useState } from "react";
import { Badge } from "@/components/commons/Badge";
import type { CourseData } from "@/shared/types/feed.types";
import { generateContextLabel } from "@/shared/utils/feedContext";

export function FeedFeaturedCard({
  course,
  onSelect,
}: {
  course: CourseData;
  onSelect: (course: CourseData) => void;
}) {
  const [pressed, setPressed] = useState(false);
  const contextLabel = generateContextLabel(course, new Date().getHours());

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border cursor-pointer select-none"
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
      <div className="aspect-7/4 relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://picsum.photos/seed/${course.imageSeed}/400/200`}
          alt={course.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.65) 100%)",
          }}
        />

        <div className="absolute top-3 left-3 right-3 flex justify-between items-start gap-2">
          <div>
            {course.availability === "available" && (
              <Badge variant="accent">지금 갈 수 있어요</Badge>
            )}
          </div>
          {course.festival && <Badge variant="point">오늘 축제</Badge>}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3.5 text-white">
          <div className="text-[16px] font-bold mb-0.5 tracking-[-0.01em]">
            {course.name}
          </div>
          <div className="text-[12px] opacity-90 mb-1">{course.region}</div>
          {contextLabel ? (
            <div className="text-[12px] opacity-85 mt-1">{contextLabel}</div>
          ) : course.todayCompletions && course.todayCompletions.count > 0 ? (
            <div className="text-[12px] opacity-85 mt-1">오늘 {course.todayCompletions.count}명이 완료했어요</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
