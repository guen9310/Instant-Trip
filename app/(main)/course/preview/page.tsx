"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CourseResultView } from "@/components/domains/course/CourseResultView";
import type { JourneyPlace } from "@/shared/types/course.types";

type PendingCourse = {
  places: JourneyPlace[];
  courseName: string;
  mapX?: number;
  mapY?: number;
  scale?: string;
};

export default function CoursePreviewPage() {
  const router = useRouter();
  const [course, setCourse] = useState<PendingCourse | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("pendingCourse");
      if (!raw) {
        router.push("/start");
        return;
      }
      const parsed: PendingCourse = JSON.parse(raw);
      if (!parsed.places || !parsed.courseName) {
        router.push("/start");
        return;
      }
      setCourse(parsed);
    } catch {
      router.push("/start");
    }
  }, [router]);

  if (!course) return null;

  return (
    <CourseResultView
      courseId="preview"
      courseName={course.courseName}
      places={course.places}
      mapX={course.mapX}
      mapY={course.mapY}
      scale={course.scale}
    />
  );
}
