"use client";

import { useEffect, useState } from "react";
import { FeedFeaturedCard } from "./FeedFeaturedCard";
import { FeedMidCard } from "./FeedMidCard";
import { FeedSmallCard } from "./FeedSmallCard";
import { FeedListCard } from "./FeedListCard";
import { FeedCourseSheet } from "./FeedCourseSheet";
import { Switch } from "@/components/commons/switch";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/commons/Carousel";
import {
  FEED_FEATURED,
  FEED_MID_COURSES,
  FEED_SMALL_COURSES,
  FEED_LIST_COURSES,
} from "@/shared/constants/feedMock";
import type { FeedCourse } from "@/shared/types/feed.types";

const MAX_LIST = 10;
const MAX_PER_PAGE = 3;

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size)
    result.push(arr.slice(i, i + size));
  return result;
}

export function FeedList() {
  const [selectedCourse, setSelectedCourse] = useState<FeedCourse | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [api, setApi] = useState<CarouselApi>();

  const filteredCourses = (
    onlyAvailable
      ? FEED_LIST_COURSES.filter((c) => c.availability === "available")
      : FEED_LIST_COURSES
  ).slice(0, MAX_LIST);

  const pages = chunk(filteredCourses, MAX_PER_PAGE);

  useEffect(() => {
    if (!api) return;
    api.scrollTo(0);
  }, [api, onlyAvailable]);

  const handleSelect = (course: FeedCourse) => {
    setSelectedCourse(course);
    setSheetOpen(true);
    setSheetKey((k) => k + 1);
  };

  const handleToggleAvailable = (checked: boolean) => {
    setOnlyAvailable(checked);
  };

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

      <div className="mt-6 mb-3 flex items-center justify-between">
        <p className="text-[15px] font-bold text-text-primary tracking-[-0.02em]">
          마음에 드는 게 없다면
        </p>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-[12px] text-text-secondary">
            지금 가능한 코스만
          </span>
          <Switch
            checked={onlyAvailable}
            onCheckedChange={handleToggleAvailable}
          />
        </label>
      </div>

      <div>
        <Carousel setApi={setApi} opts={{ align: "start", dragFree: false }}>
          <CarouselContent className="ml-0">
            {pages.map((pageItems, pageIndex) => (
              <CarouselItem
                key={pageIndex}
                className="pl-0 basis-[calc(100%-16px)]"
              >
                <div className="flex flex-col gap-2">
                  {pageItems.map((course) => (
                    <div key={course.id}>
                      <FeedListCard course={course} onSelect={handleSelect} />
                    </div>
                  ))}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>

      <FeedCourseSheet
        key={sheetKey}
        course={selectedCourse}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
