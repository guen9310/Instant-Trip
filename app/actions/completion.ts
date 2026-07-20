"use server";

import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "@/server/db";
import { courses, coursePlaces, courseCompletions } from "@/server/schema";
import { getSession } from "@/server/session";
import {
  courseCompletionSchema,
  type CourseCompletionPayload,
} from "@/shared/schemas/courseCompletion";
import type { JourneyPlace } from "@/shared/types/course.types";

// ─── TODO 1: 코스 시작 시 DB 행 생성 ──────────────────────────────────────────
// 프리뷰 화면에서 "이 코스로 갈게요" 탭 시 호출.
// courses + course_places + course_completions(status='active')를 원자적으로 삽입하고
// 생성된 ID를 반환한다 — 클라이언트는 이를 localStorage에 저장해 완료 시 UPDATE에 사용.

type StartCoursePayload = {
  courseName: string;
  scale: string;
  region?: string;
  place: JourneyPlace;
};

type StartCourseResult =
  | { ok: true; completionId: string; dbCourseId: string }
  // reason: "unauthenticated" — 비로그인 상태. 호출부(CourseResultView)가 이를
  // 다른 실패(DB 오류 등)와 구분해 로그인 안내로 분기한다.
  | { ok: false; reason?: "unauthenticated" };

export async function startCourseAction(
  payload: StartCoursePayload,
): Promise<StartCourseResult> {
  try {
    const session = await getSession();
    if (!session?.user) return { ok: false, reason: "unauthenticated" };

    const dbCourseId = crypto.randomUUID();
    const completionId = crypto.randomUUID();
    const { place } = payload;

    await db.batch([
      db.insert(courses).values({
        id: dbCourseId,
        name: payload.courseName,
        region: payload.region ?? "알 수 없음",
        regionCode: payload.region ?? "unknown",
        scale: payload.scale,
      }),
      db.insert(coursePlaces).values({
        courseId: dbCourseId,
        orderIndex: 0,
        name: place.name,
        category: place.cat,
        address: place.addr,
        lat: place.coord ? String(place.coord.lat) : null,
        lng: place.coord ? String(place.coord.lng) : null,
        stayMin: place.estimatedDuration.min,
        stayMax: place.estimatedDuration.max,
        stayDurationKey: place.stayDurationKey ?? null,
        availabilityUncertain: place.availabilityUncertain,
        description: place.desc || null,
        badgeText: place.badge.text || null,
        badgeVariant: place.badge.variant || null,
      }),
      db.insert(courseCompletions).values({
        id: completionId,
        userId: session.user.id,
        courseId: dbCourseId,
        status: "active",
        currentPlaceIndex: 0,
        startedAt: new Date(),
      }),
    ]);

    return { ok: true, completionId, dbCourseId };
  } catch (err) {
    console.error("[start] 저장 실패:", err);
    return { ok: false };
  }
}

// ─── 완료/포기 기록 저장 ────────────────────────────────────────────────────────
// completionId + dbCourseId가 있으면 기존 행을 UPDATE (TODO 1 연동).
// 없으면 INSERT fallback — startCourseAction 실패/미호출 시 기존 동작 유지.
// 어떤 실패도 사용자 흐름으로 전파하지 않는다(조용히 skip).
export async function saveCourseCompletionAction(
  payload: CourseCompletionPayload,
): Promise<{ ok: boolean }> {
  try {
    const session = await getSession();
    if (!session?.user) return { ok: false };

    const parsed = courseCompletionSchema.safeParse(payload);
    if (!parsed.success) return { ok: false };
    const d = parsed.data;

    const completedAt =
      d.status === "abandoned" ? null : new Date(d.completedAt ?? Date.now());
    const startedAt = d.startedAt
      ? new Date(d.startedAt)
      : (completedAt ?? new Date());

    // ── UPDATE 경로 ────────────────────────────────────────────────────────────
    if (d.completionId && d.dbCourseId) {
      await db
        .update(courseCompletions)
        .set({
          status: d.status,
          rating: d.rating,
          review: d.reactions.length ? d.reactions.join(", ") : null,
          startedAt,
          completedAt,
          travelDistM: d.travelDistM,
          locationStamps: d.stamps.length ? d.stamps : null,
        })
        .where(
          and(
            eq(courseCompletions.id, d.completionId),
            eq(courseCompletions.userId, session.user.id),
          ),
        );

      // TODO 3: 평점 집계
      if (d.rating != null) {
        await updateCourseRating(d.dbCourseId);
      }

      return { ok: true };
    }

    // ── INSERT fallback ────────────────────────────────────────────────────────
    // neon-http는 트랜잭션 미지원 → db.batch(단일 HTTP 트랜잭션)로 원자성 확보.
    // batch는 RETURNING 체이닝이 불가하므로 course id를 사전 생성한다.
    const courseId = crypto.randomUUID();

    await db.batch([
      db.insert(courses).values({
        id: courseId,
        name: d.courseName,
        region: d.region ?? "알 수 없음",
        regionCode: d.region ?? "unknown",
        scale: d.scale,
      }),
      db.insert(coursePlaces).values({
        courseId,
        orderIndex: 0,
        name: d.place.name,
        category: d.place.category,
        address: d.place.address,
        lat: d.place.coord ? String(d.place.coord.lat) : null,
        lng: d.place.coord ? String(d.place.coord.lng) : null,
        stayMin: d.place.stayMin,
        stayMax: d.place.stayMax,
        stayDurationKey: d.place.stayDurationKey ?? null,
        availabilityUncertain: d.place.availabilityUncertain,
        description: d.place.description || null,
        badgeText: d.place.badgeText || null,
        badgeVariant: d.place.badgeVariant || null,
      }),
      db.insert(courseCompletions).values({
        userId: session.user.id,
        courseId,
        status: d.status,
        currentPlaceIndex: 0,
        rating: d.rating,
        review: d.reactions.length ? d.reactions.join(", ") : null,
        startedAt,
        completedAt,
        travelDistM: d.travelDistM,
        locationStamps: d.stamps.length ? d.stamps : null,
      }),
    ]);

    if (d.rating != null) {
      await updateCourseRating(courseId);
    }

    return { ok: true };
  } catch (err) {
    console.error("[completion] 저장 실패:", err);
    return { ok: false };
  }
}

// ─── TODO 3: courses.rating_avg / review_count 집계 갱신 ──────────────────────
// 해당 course의 완료 기록에서 평점이 있는 행을 모두 읽어 평균·건수를 재산출한다.
async function updateCourseRating(courseId: string): Promise<void> {
  try {
    const rows = await db
      .select({ rating: courseCompletions.rating })
      .from(courseCompletions)
      .where(
        and(
          eq(courseCompletions.courseId, courseId),
          isNotNull(courseCompletions.rating),
        ),
      );

    if (rows.length === 0) return;

    const sum = rows.reduce((acc, r) => acc + (r.rating ?? 0), 0);
    const ratingAvg = (sum / rows.length).toFixed(2);

    await db
      .update(courses)
      .set({ ratingAvg, reviewCount: rows.length })
      .where(eq(courses.id, courseId));
  } catch (err) {
    console.error("[rating] 집계 실패:", err);
  }
}
