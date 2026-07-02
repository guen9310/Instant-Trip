"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CourseResultView } from "@/components/domains/course/CourseResultView";
import type { JourneyPlace, FestivalSummary } from "@/shared/types/course.types";

type PendingCourse = {
  places: JourneyPlace[];
  courseName: string;
  festivals?: FestivalSummary[];
  mapX?: number;
  mapY?: number;
  scale?: string;
};

function readPendingCourse(): PendingCourse | null {
  try {
    const raw = sessionStorage.getItem("pendingCourse");
    if (!raw) return null;
    const parsed: PendingCourse = JSON.parse(raw);
    if (!parsed.places || !parsed.courseName) return null;
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCourse(loaded);
  }, []);

  useEffect(() => {
    if (course === null) router.push("/start");
  }, [course, router]);

  if (course === "loading" || course === null) return null;

  return (
    <CourseResultView
      courseId="preview"
      courseName={course.courseName}
      places={course.places}
      festivals={course.festivals ?? []}
      mapX={course.mapX}
      mapY={course.mapY}
      scale={course.scale}
    />
  );
}
