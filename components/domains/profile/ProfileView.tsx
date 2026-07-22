"use client";

import { useState } from "react";
import Image from "next/image";
import { Settings, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/commons/Badge";
import { buttonVariants } from "@/components/commons/Button";
import { cn } from "@/shared/utils";
import { StarRating } from "@/components/domains/profile/StarRating";
import { CompletedCourseDetailModal } from "@/components/domains/profile/CompletedCourseDetailModal";
import { buildReexplorationText } from "@/shared/utils/prefsText";
import type { User } from "@/shared/types/auth.types";
import type { CourseProgress, CompletedCourse } from "@/shared/types/course.types";
import type { Prefs } from "@/shared/constants/preferences";

type Props = {
  user: User;
  // DB에 저장된 취향 — 서버 컴포넌트(profile/page.tsx)에서 세션으로 읽어 주입한다
  prefs: Prefs;
  inProgress: CourseProgress | null;
  completed: CompletedCourse[];
};

export function ProfileView({ user, prefs, inProgress, completed }: Props) {
  const [selected, setSelected] = useState<CompletedCourse | null>(null);
  const reexploration = buildReexplorationText(prefs);

  const isNewUser = inProgress === null && completed.length === 0;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5">
      {/* 헤더 */}
      <div className="mb-4 flex items-center justify-end">
        <Link href="/settings" className="-mr-1 p-1 text-text-secondary">
          <Settings size={20} />
        </Link>
      </div>

      {/* 아바타 */}
      <div className="mb-6 flex flex-col items-center">
        <div className="relative mb-2.5 h-20 w-20 rounded-full overflow-hidden">
          <Image
            src={user.image ?? "/images/profile.svg"}
            alt={user.name}
            fill
            sizes="80px"
            className="object-cover"
          />
        </div>
        <p className="text-[14px] font-medium text-text-primary">
          {user.email}
        </p>
      </div>

      {/* 통계 */}
      <div className="mb-6 rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-[12px] text-text-secondary">완료한 외출</p>
        <p className="mt-1 text-[22px] font-bold text-text-primary tabular-nums">
          {completed.length}
        </p>
      </div>

      {/* 신규 사용자 — 두 섹션을 하나의 온보딩 블록으로 통합 */}
      {isNewUser ? (
        <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-5 py-6 flex flex-col items-center text-center gap-3">
          <p className="text-[16px] font-bold text-text-primary tracking-tight">
            첫 즉흥 여행을 떠나볼까요?
          </p>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            외출을 마치면 여기에<br />기록과 도장이 쌓여요
          </p>
          <Link
            href="/start"
            className={cn(
              buttonVariants({ size: "default" }),
              "mt-1 rounded-xl px-6 text-[14px] font-semibold",
            )}
          >
            어디 갈지 뽑으러 가기
          </Link>
        </div>
      ) : (
        <>
          {/* 진행 중인 코스 */}
          <h3 className="mb-2.5 text-[13px] font-semibold text-text-secondary">
            진행 중인 외출
          </h3>
          {inProgress ? (
            <div
              className={cn(
                "mb-6 flex items-center gap-3 rounded-xl",
                "border border-border bg-card px-3.5 py-3.5",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-text-primary">
                    {inProgress.name}
                  </span>
                  <Badge variant="secondary">진행 중</Badge>
                </div>
              </div>
              <Link
                href={`/course/active/${inProgress.courseId}`}
                className={cn(
                  buttonVariants({ size: "default" }),
                  "shrink-0 rounded-lg px-3.5 text-[13px] font-semibold",
                )}
              >
                이어서
              </Link>
            </div>
          ) : (
            <div className="mb-6 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-6">
              <p className="text-[13px] text-text-secondary">
                진행 중인 외출이 없어요
              </p>
              <Link
                href="/start"
                className="flex items-center gap-0.5 text-[13px] font-semibold text-primary"
              >
                어디 갈지 뽑으러 가기
                <ChevronRight size={14} />
              </Link>
            </div>
          )}

          {/* 완료한 코스 */}
          <h3 className="mb-2.5 text-[13px] font-semibold text-text-secondary">
            완료한 외출
          </h3>
          <div className="mb-4 flex flex-col gap-2.5">
            {completed.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="rounded-xl border border-border bg-card px-3.5 py-3.5 text-left"
              >
                <div className="mb-1.5">
                  <span className="text-[12px] tabular-nums text-text-secondary">
                    {c.date}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[14px] font-medium text-text-primary">
                    {c.name}
                  </p>
                  <StarRating rating={c.rating} />
                </div>
              </button>
            ))}
          </div>

          {/* 재탐색 제안 */}
          <div className="mb-6 rounded-xl border border-border bg-card px-4 py-4">
            <p className="text-[13px] text-text-primary leading-[1.65] mb-3">
              {reexploration.line1}
              <br />
              {reexploration.line2}
            </p>
            <Link
              href="/start"
              className="flex items-center gap-0.5 text-[13px] font-semibold text-primary"
            >
              근처 장소 둘러보기
              <ChevronRight size={14} />
            </Link>
          </div>
        </>
      )}

      <CompletedCourseDetailModal
        course={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
