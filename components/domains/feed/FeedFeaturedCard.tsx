"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Badge } from "@/components/commons/Badge";
import type { CourseData } from "@/shared/types/feed.types";

export function FeedFeaturedCard({
  course,
  onSelect,
}: {
  course: CourseData;
  onSelect: (course: CourseData) => void;
}) {
  const [pressed, setPressed] = useState(false);

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
            {course.availability === "partial" && (
              <Badge className="bg-black/40 text-white border-0 backdrop-blur-sm">
                일부 장소 확인 필요
              </Badge>
            )}
          </div>
          {course.festival && <Badge variant="point">오늘 축제</Badge>}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3.5 text-white">
          <div className="text-[16px] font-bold mb-0.5 tracking-[-0.01em]">
            {course.name}
          </div>
          <div className="text-[12px] opacity-90 mb-1">{course.region}</div>
          {course.todayCompletions && (
            <div className="text-[11px] opacity-60 mb-2">
              {course.todayCompletions.timeframe}{" "}
              {course.todayCompletions.count}명이 완료
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1">
              <Star
                size={13}
                strokeWidth={1.5}
                className="fill-point text-point"
              />
              <span className="text-[13px] font-semibold tabular-nums">
                {course.rating}
              </span>
            </div>
            <span className="text-[12px] opacity-85">
              완료 {course.count}명
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
