import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { courses, coursePlaces, courseCompletions } from "@/server/schema";
import {
  toCourseProgress,
  toCompletedCourse,
} from "@/server/mappers";
import type { CourseProgress, CompletedCourse } from "@/shared/types/course.types";

function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${totalMin}분`;
}

// ─── TODO 1: 프로필 진행 중인 코스 ───────────────────────────────────────────

export async function getActiveCourse(
  userId: string,
): Promise<CourseProgress | null> {
  const rows = await db
    .select({ completion: courseCompletions, course: courses })
    .from(courseCompletions)
    .innerJoin(courses, eq(courseCompletions.courseId, courses.id))
    .where(
      and(
        eq(courseCompletions.userId, userId),
        eq(courseCompletions.status, "active"),
      ),
    )
    .orderBy(desc(courseCompletions.createdAt))
    .limit(1);

  if (rows.length === 0) return null;
  return toCourseProgress(rows[0].completion, rows[0].course);
}

// ─── TODO 1: 프로필 완료 목록 ─────────────────────────────────────────────────

export async function getCompletedCourses(
  userId: string,
): Promise<CompletedCourse[]> {
  const rows = await db
    .select({ completion: courseCompletions, course: courses })
    .from(courseCompletions)
    .innerJoin(courses, eq(courseCompletions.courseId, courses.id))
    .where(
      and(
        eq(courseCompletions.userId, userId),
        eq(courseCompletions.status, "completed"),
      ),
    )
    .orderBy(desc(courseCompletions.completedAt));

  if (rows.length === 0) return [];

  const courseIds = rows.map((r) => r.course.id);
  const placeRows = await db
    .select()
    .from(coursePlaces)
    .where(inArray(coursePlaces.courseId, courseIds))
    .orderBy(coursePlaces.orderIndex);

  const placesByCourseId = placeRows.reduce<
    Record<string, typeof placeRows>
  >((acc, p) => {
    (acc[p.courseId] ??= []).push(p);
    return acc;
  }, {});

  return rows.map(({ completion, course }) => {
    const places = placesByCourseId[course.id] ?? [];
    const result = toCompletedCourse(completion, course, places);
    if (completion.startedAt && completion.completedAt) {
      const ms =
        completion.completedAt.getTime() - completion.startedAt.getTime();
      result.duration = formatDuration(ms);
    }
    return result;
  });
}

