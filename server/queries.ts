import { eq, and, desc, gte, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { courses, coursePlaces, courseCompletions } from "@/server/schema";
import {
  toCourseProgress,
  toCompletedCourse,
  toJourneyPlace,
} from "@/server/mappers";
import type {
  CourseProgress,
  CompletedCourse,
  ResumableCourse,
} from "@/shared/types/course.types";
import { isUuid } from "@/shared/utils";

function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${totalMin}분`;
}

// ─── 프로필 진행 중인 코스 ────────────────────────────────────────────────────

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
  const { completion, course } = rows[0];

  const places = await db
    .select()
    .from(coursePlaces)
    .where(eq(coursePlaces.courseId, course.id));

  return toCourseProgress(completion, course, places);
}

// ─── /course/active/[id] DB fallback ─────────────────────────────────────────
// 프로필 "이어서"는 DB courses.id를 가리키는데, 진행 화면은 localStorage의
// pendingCourse만 읽는다. 그 localStorage가 없거나(다른 기기·저장소 초기화) 다른
// 코스로 덮어써졌을 때, 이 courseId로 이 유저의 활성 코스를 복원할 수 있는지 확인한다.
// userId로 소유자를 검증해 남의 활성 코스를 들여다볼 수 없게 한다.
export async function getResumableCourse(
  userId: string,
  courseId: string,
): Promise<ResumableCourse | null> {
  // 코스를 갓 생성했을 때는 /course/active/[id]의 id가 클라이언트에서 만든 courseId(nanoid 등)라
  // DB courses.id(uuid) 형식이 아니다 — courses.id는 uuid 컬럼이라 그 값을 그대로 비교하면
  // Postgres가 "invalid input syntax for type uuid"로 쿼리 자체를 실패시킨다. 매칭될 수 없는
  // 형식이면 DB를 조회할 필요도 없으니 여기서 걸러낸다.
  if (!isUuid(courseId)) return null;

  const rows = await db
    .select({ completion: courseCompletions, course: courses, place: coursePlaces })
    .from(courseCompletions)
    .innerJoin(courses, eq(courseCompletions.courseId, courses.id))
    .innerJoin(coursePlaces, eq(coursePlaces.courseId, courses.id))
    .where(
      and(
        eq(courseCompletions.userId, userId),
        eq(courses.id, courseId),
        eq(courseCompletions.status, "active"),
        eq(coursePlaces.orderIndex, 0),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;
  const { completion, course, place } = rows[0];
  return {
    completionId: completion.id,
    courseId: course.id,
    courseName: course.name,
    scale: course.scale,
    place: toJourneyPlace(place),
  };
}

// ─── 최근 완료 장소 좌표 (재추천 쿨다운) ──────────────────────────────────────
// coursePlaces엔 contentId가 없어(스키마상 저장 안 됨) 좌표로만 "같은 장소"를
// 판정할 수 있다 — 좌표는 파이프라인이 생성 시점에 그대로 저장한 값이라
// 반올림 일치(coordKey, shared/utils/geo.ts)로 안전하게 매칭된다.
export async function getRecentlyVisitedCoords(
  userId: string,
  sinceDate: Date,
): Promise<{ lat: number; lng: number }[]> {
  const rows = await db
    .select({ lat: coursePlaces.lat, lng: coursePlaces.lng })
    .from(courseCompletions)
    .innerJoin(coursePlaces, eq(coursePlaces.courseId, courseCompletions.courseId))
    .where(
      and(
        eq(courseCompletions.userId, userId),
        eq(courseCompletions.status, "completed"),
        gte(courseCompletions.completedAt, sinceDate),
      ),
    );

  return rows
    .filter((r): r is { lat: string; lng: string } => r.lat !== null && r.lng !== null)
    .map((r) => ({ lat: parseFloat(r.lat), lng: parseFloat(r.lng) }));
}

// ─── 프로필 완료 목록 ──────────────────────────────────────────────────────────

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
