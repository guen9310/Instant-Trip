"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CourseResultView } from "@/components/domains/course/CourseResultView";
import { useClientRead, HYDRATING } from "@/client/hooks/useClientRead";
import type { CourseProgress, PendingCourse } from "@/shared/types/course.types";

function readPendingCourse(): PendingCourse | null {
  try {
    const raw = localStorage.getItem("pendingCourse");
    if (!raw) return null;
    const parsed: PendingCourse = JSON.parse(raw);
    if (!parsed.courseId || !parsed.place || !parsed.courseName) return null;
    return parsed;
  } catch {
    return null;
  }
}

type Props = {
  isAuthenticated: boolean;
  activeCourse: CourseProgress | null;
};

export function CoursePreviewClient({ isAuthenticated, activeCourse }: Props) {
  const router = useRouter();
  const course = useClientRead(readPendingCourse);

  // 저장된 코스가 없으면 시작 화면으로 — 라우팅은 렌더가 아닌 효과에서 수행
  useEffect(() => {
    if (course === null) router.push("/start");
  }, [course, router]);

  if (course === HYDRATING || course === null) return null;

  return (
    <CourseResultView
      courseId={course.courseId}
      courseName={course.courseName}
      place={course.place}
      mapX={course.mapX}
      mapY={course.mapY}
      scale={course.scale}
      prefs={course.prefs}
      availability={course.availability}
      generatedAt={course.generatedAt}
      isAuthenticated={isAuthenticated}
      activeCourse={activeCourse}
    />
  );
}
