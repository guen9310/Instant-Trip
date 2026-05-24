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
import { useLocationStore } from "@/client/stores/useLocationStore";
import type { FeedCourse } from "@/shared/types/feed.types";

const MAX_LIST = 10;
const MAX_PER_PAGE = 3;

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size)
    result.push(arr.slice(i, i + size));
  return result;
}

type Props = {
  featured: FeedCourse | null;
  midCourses: FeedCourse[];
  smallCourses: FeedCourse[];
  listCourses: FeedCourse[];
  isLoading?: boolean;
};

export function FeedList({
  featured,
  midCourses,
  smallCourses,
  listCourses,
  isLoading = false,
}: Props) {
  const { state } = useLocationStore();
  const city = state.status === "granted" ? state.city : null;
  const [selectedCourse, setSelectedCourse] = useState<FeedCourse | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [api, setApi] = useState<CarouselApi>();

  const filteredList = (
    onlyAvailable
      ? listCourses.filter((c) => c.availability === "available")
      : listCourses
  ).slice(0, MAX_LIST);

  const pages = chunk(filteredList, MAX_PER_PAGE);

  useEffect(() => {
    if (!api) return;
    api.scrollTo(0);
  }, [api, onlyAvailable]);

  const handleSelect = (course: FeedCourse) => {
    setSelectedCourse(course);
    setSheetOpen(true);
    setSheetKey((k) => k + 1);
  };

  if (isLoading) {
    return <FeedSkeleton />;
  }

  return (
    <>
      {/* Featured */}
      {featured ? (
        <div className="mb-2">
          <FeedFeaturedCard course={featured} onSelect={handleSelect} />
        </div>
      ) : null}

      {/* Mid 2열 */}
      {midCourses.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 mb-2">
          {midCourses.map((course) => (
            <FeedMidCard key={course.id} course={course} onSelect={handleSelect} />
          ))}
        </div>
      ) : null}

      {/* Small 3열 */}
      {smallCourses.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {smallCourses.map((course) => (
            <FeedSmallCard key={course.id} course={course} onSelect={handleSelect} />
          ))}
        </div>
      ) : null}

      {/* 추천 섹션이 전부 비었고 리스트도 없는 경우 */}
      {!featured && midCourses.length === 0 && smallCourses.length === 0 && listCourses.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-12 mb-2">
          <p className="text-[14px] font-medium text-text-primary">
            지금 근처에 추천 코스가 없어요
          </p>
          <p className="text-[12px] text-text-secondary text-center leading-relaxed">
            취향 설정을 바꾸거나<br />다른 지역을 선택해보세요
          </p>
        </div>
      )}

      {/* 리스트 섹션 */}
      <div className="mt-6 mb-3 flex items-center justify-between">
        <p className="text-[15px] font-bold text-text-primary tracking-[-0.02em]">
          {!featured && midCourses.length === 0 && smallCourses.length === 0
            ? (city ? `${city} 주변 코스예요` : "이런 코스 어때요?")
            : "마음에 드는 게 없다면"}
        </p>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-[12px] text-text-secondary">지금 가능한 코스만</span>
          <Switch
            checked={onlyAvailable}
            onCheckedChange={setOnlyAvailable}
            disabled={listCourses.length === 0}
          />
        </label>
      </div>

      {filteredList.length > 0 ? (
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
      ) : (
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-card px-4 py-6">
          <p className="text-[13px] text-text-secondary">
            {onlyAvailable ? "지금 바로 갈 수 있는 코스가 없어요" : "코스가 없어요"}
          </p>
          {onlyAvailable && (
            <button
              onClick={() => setOnlyAvailable(false)}
              className="text-[13px] font-semibold text-primary"
            >
              전체 코스 보기
            </button>
          )}
        </div>
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

function FeedSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-48 rounded-2xl bg-muted" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-36 rounded-2xl bg-muted" />
        <div className="h-36 rounded-2xl bg-muted" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="mt-6 h-5 w-32 rounded bg-muted" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-muted" />
      ))}
    </div>
  );
}
