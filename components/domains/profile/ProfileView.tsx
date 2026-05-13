"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/commons/Badge";
import { buttonVariants } from "@/components/commons/Button";
import { cn } from "@/shared/utils";
import { StarRating } from "@/components/domains/profile/StarRating";
import { CompletedCourseDetailModal, type CompletedCourse } from "@/components/domains/profile/CompletedCourseDetailModal";

const STATS = [
  { label: "완료한 코스", value: 3 },
  { label: "방문한 지역", value: 2 },
];

const IN_PROGRESS = {
  name: "적당히 즐기는 코스",
  progress: "1 / 3",
  region: "종로구",
  courseId: "1",
};

const COMPLETED = [
  {
    name: "성수 골목 산책",
    date: "2026.04.28",
    region: "서울 성동구",
    duration: "2시간",
    places: [
      { name: "성수동 카페거리", category: "문화시설" },
      { name: "서울숲", category: "관광지" },
      { name: "뚝섬한강공원", category: "관광지" },
    ],
    rating: 5,
    review: "날씨도 좋고 코스가 딱 적당했다",
  },
  {
    name: "망원 한강 산책",
    date: "2026.04.21",
    region: "서울 마포구",
    duration: "1시간 30분",
    places: [
      { name: "망원시장", category: "전통시장" },
      { name: "한강공원", category: "관광지" },
    ],
    rating: 4,
    review: "",
  },
];

export function ProfileView() {
  const [selected, setSelected] = useState<CompletedCourse | null>(null);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5">
      {/* 아바타 */}
      <div className="mb-6 flex flex-col items-center">
        <div
          className={cn(
            "mb-2.5 flex h-20 w-20 items-center justify-center rounded-full",
            "bg-primary text-[30px] font-bold text-white",
          )}
        >
          U
        </div>
        <p className="text-[14px] font-medium text-text-primary">
          example@email.com
        </p>
        <p className="mt-0.5 text-[12px] text-text-secondary">
          완료한 코스 3개
        </p>
      </div>

      {/* 통계 */}
      <div className="mb-6 grid grid-cols-2 gap-2.5">
        {STATS.map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[12px] text-text-secondary">{label}</p>
            <p className="mt-1 text-[22px] font-bold text-text-primary tabular-nums">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* 진행 중인 코스 */}
      <h3 className="mb-2.5 text-[13px] font-semibold text-text-secondary">
        진행 중인 코스
      </h3>
      <div
        className={cn(
          "mb-6 flex items-center gap-3 rounded-xl",
          "border border-border bg-card px-3.5 py-3.5",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[14px] font-semibold text-text-primary">
              {IN_PROGRESS.name}
            </span>
            <Badge variant="secondary">진행 중</Badge>
          </div>
          <p className="text-[12px] text-text-secondary">
            {IN_PROGRESS.progress} · {IN_PROGRESS.region}
          </p>
        </div>
        <Link
          href={`/course/${IN_PROGRESS.courseId}/active`}
          className={cn(
            buttonVariants({ size: "default" }),
            "shrink-0 rounded-lg px-3.5 text-[13px] font-semibold",
          )}
        >
          이어서
        </Link>
      </div>

      {/* 완료한 코스 */}
      <h3 className="mb-2.5 text-[13px] font-semibold text-text-secondary">
        완료한 코스
      </h3>
      <div className="mb-6 flex flex-col gap-2.5">
        {COMPLETED.map((c) => (
          <button
            key={c.date}
            onClick={() => setSelected(c)}
            className="rounded-xl border border-border bg-card px-3.5 py-3.5 text-left"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[12px] tabular-nums text-text-secondary">
                {c.date}
              </span>
              <Badge variant="outline">완료</Badge>
            </div>
            <p className="mb-1.5 text-[14px] font-medium text-text-primary">
              {c.name}
            </p>
            <StarRating rating={c.rating} />
          </button>
        ))}
      </div>

      <CompletedCourseDetailModal
        course={selected}
        onClose={() => setSelected(null)}
      />

      {/* 하단 버튼 */}
      <div className="flex flex-col gap-2.5">
        <Link
          href="/settings"
          className={cn(
            "flex h-11 w-full items-center justify-center gap-1.5 rounded-lg",
            "border border-border text-[14px] font-medium text-text-primary",
          )}
        >
          <Settings size={15} />
          취향 설정 변경하기
        </Link>
        <button
          className={cn(
            "flex h-11 w-full items-center justify-center rounded-lg",
            "border border-border text-[14px] font-medium text-destructive",
          )}
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
