"use client";

import { useState } from "react";
import { Badge } from "@/components/commons/Badge";
import type { CourseData } from "@/shared/types/feed.types";
import { generateContextLabel } from "@/shared/utils/feedContext";

export function FeedMidCard({
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
      <div className="aspect-4/3 relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://picsum.photos/seed/${course.imageSeed}/200/120`}
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

        <div className="absolute top-2 left-2 right-2 flex justify-between items-start gap-1">
          <div>
            {course.availability === "available" && (
              <Badge variant="accent" className="text-[10px] px-1.5 py-0">
                지금 갈 수 있어요
              </Badge>
            )}
          </div>
          {course.festival && (
            <Badge variant="point" className="text-[10px] px-1.5 py-0">
              오늘 축제
            </Badge>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
          <div className="text-[14px] font-bold mb-0.5 tracking-[-0.01em] leading-tight">
            {course.name}
          </div>
          <div className="flex justify-between items-center gap-1">
            <span className="text-[12px] opacity-90 truncate min-w-0">
              {course.region}
            </span>
          </div>
          {contextLabel ? (
            <div className="text-[10px] opacity-75 mt-0.5">{contextLabel}</div>
          ) : course.todayCompletions && course.todayCompletions.count > 0 ? (
            <div className="text-[10px] opacity-75 mt-0.5">오늘 {course.todayCompletions.count}명이 완료했어요</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
