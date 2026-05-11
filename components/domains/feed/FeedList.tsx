"use client";

import { useEffect, useRef, useState } from "react";
import { FeedFeaturedCard } from "./FeedFeaturedCard";
import { FeedMidCard } from "./FeedMidCard";
import { FeedSmallCard } from "./FeedSmallCard";
import { FeedListCard } from "./FeedListCard";
import { FeedCourseSheet } from "./FeedCourseSheet";
import { Switch } from "@/components/commons/switch";
import { useIntersectionObserver } from "@/client/hooks/useIntersectionObserver";
import {
  FEED_FEATURED,
  FEED_MID_COURSES,
  FEED_SMALL_COURSES,
  FEED_LIST_COURSES,
} from "@/shared/constants/feedMock";
import type { CourseData } from "@/shared/types/feed.types";

const PAGE_SIZE = 5;

export function FeedList() {
  const [selectedCourse, setSelectedCourse] = useState<CourseData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const filteredCourses = onlyAvailable
    ? FEED_LIST_COURSES.filter((c) => c.availability === "available")
    : FEED_LIST_COURSES;

  const sourceLengthRef = useRef(filteredCourses.length);
  sourceLengthRef.current = filteredCourses.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [onlyAvailable]);

  const { ref: sentinelRef } = useIntersectionObserver(() => {
    setVisibleCount((prev) =>
      prev < sourceLengthRef.current
        ? Math.min(prev + PAGE_SIZE, sourceLengthRef.current)
        : prev,
    );
  });

  const handleSelect = (course: CourseData) => {
    setSelectedCourse(course);
    setSheetOpen(true);
    setSheetKey((k) => k + 1);
  };

  const visibleCourses = filteredCourses.slice(0, visibleCount);
  const hasMore = visibleCount < filteredCourses.length;

  return (
    <>
      <div className="mb-2">
        <FeedFeaturedCard course={FEED_FEATURED} onSelect={handleSelect} />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {FEED_MID_COURSES.map((course) => (
          <FeedMidCard
            key={course.id}
            course={course}
            onSelect={handleSelect}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {FEED_SMALL_COURSES.map((course) => (
          <FeedSmallCard
            key={course.id}
            course={course}
            onSelect={handleSelect}
          />
        ))}
      </div>

      <div className="mt-6 mb-1 flex items-center justify-between">
        <p className="text-[15px] font-bold text-text-primary tracking-[-0.02em]">
          더 많은 코스
        </p>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-[12px] text-text-secondary">지금 가능한 코스만 보기</span>
          <Switch
            checked={onlyAvailable}
            onCheckedChange={setOnlyAvailable}
          />
        </label>
      </div>
      <div>
        {visibleCourses.map((course) => (
          <FeedListCard
            key={course.id}
            course={course}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {hasMore && <div ref={sentinelRef} className="h-8" />}

      {!hasMore && (
        <p className="text-center text-[11px] text-muted-foreground py-5">
          한국관광공사 TourAPI 기반 · 실시간 운영 확인
        </p>
      )}

      <FeedCourseSheet
        key={sheetKey}
        course={selectedCourse}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
