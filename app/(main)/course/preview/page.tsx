"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CourseResultView } from "@/components/domains/course/CourseResultView";
import type { PendingCourse } from "@/shared/types/course.types";

function readPendingCourse(): PendingCourse | null {
  try {
    const raw = localStorage.getItem("pendingCourse");
    if (!raw) return null;
    const parsed: PendingCourse = JSON.parse(raw);
    if (!parsed.place || !parsed.courseName) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function CoursePreviewPage() {
  const router = useRouter();
  const [course, setCourse] = useState<PendingCourse | null | "loading">(
    "loading",
  );

  useEffect(() => {
    const loaded = readPendingCourse();
    if (!loaded) {
      router.push("/start");
      return;
    }
    setCourse(loaded);
  }, [router]);

  if (course === "loading" || course === null) return null;

  return (
    <CourseResultView
      courseId="preview"
      courseName={course.courseName}
      place={course.place}
      festivals={course.festivals ?? []}
      mapX={course.mapX}
      mapY={course.mapY}
      scale={course.scale}
    />
  );
}
