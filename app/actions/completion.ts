"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import { courses, coursePlaces, courseCompletions } from "@/server/schema";
import { getFreshAuthState } from "@/server/session";
import {
  courseCompletionSchema,
  startCourseInputSchema,
  type CourseCompletionPayload,
} from "@/shared/schemas/courseCompletion";
import type { AuthFailureReason } from "@/shared/types/auth.types";

// ─── 코스 시작 시 DB 행 생성 ───────────────────────────────────────────────────
// 프리뷰 화면에서 "이 코스로 갈게요" 탭 시 호출.
// courses + course_places + course_completions(status='active')를 원자적으로 삽입하고
// 생성된 ID를 반환한다 — 클라이언트는 이를 localStorage에 저장해 완료 시 UPDATE에 사용.

type StartCourseResult =
  | { ok: true; completionId: string; dbCourseId: string }
  // reason: "anonymous" | "invalid_session" — 호출부(CourseResultView)가 이를
  // 다른 실패(DB 오류 등)와 구분해, invalid_session만 로그인 화면의 만료 배너로 보낸다.
  | { ok: false; reason?: AuthFailureReason };

export async function startCourseAction(
  input: unknown,
): Promise<StartCourseResult> {
  try {
    const authState = await getFreshAuthState();
    if (authState.status !== "authenticated") {
      return { ok: false, reason: authState.status };
    }
    const { session } = authState;

    const parsed = startCourseInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false };
    const payload = parsed.data;

    const dbCourseId = crypto.randomUUID();
    const completionId = crypto.randomUUID();
    const { place } = payload;

    await db.batch([
      // 유저당 active는 최대 1개만 유지 — 새 코스를 시작하면 기존에 남아있던
      // active 행(들)은 자동으로 abandoned 처리한다. 클라이언트의 화면 확인
      // 여부와 무관하게 서버가 항상 이 불변조건을 강제한다(방어적 처리).
      db
        .update(courseCompletions)
        .set({ status: "abandoned" })
        .where(
          and(
            eq(courseCompletions.userId, session.user.id),
            eq(courseCompletions.status, "active"),
          ),
        ),
      db.insert(courses).values({
        id: dbCourseId,
        name: payload.courseName,
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
        availabilityUncertain: place.availabilityUncertain,
        description: place.desc || null,
        badgeText: place.badge.text || null,
        badgeVariant: place.badge.variant || null,
        placeUrl: place.placeUrl || null,
        programInfo: place.programInfo ?? null,
        organizerUrl: place.organizerUrl ?? null,
      }),
      db.insert(courseCompletions).values({
        id: completionId,
        userId: session.user.id,
        courseId: dbCourseId,
        status: "active",
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
// completionId + dbCourseId가 있으면 코스 시작 시 생성한 기존 행을 UPDATE한다.
// 없으면 INSERT fallback — startCourseAction 실패/미호출 시 기존 동작 유지.
// 완료 기록은 프로필의 근거라, 실제로 저장됐는지를 결과로 정확히 돌려준다 — 호출부는
// ok:true를 받은 뒤에만 로컬 데이터를 정리하고, 실패면 페이로드를 보존해 재시도한다.
// 성공 시 반환하는 ID로 이후 저장(후기 덧붙이기·재시도)은 항상 같은 행을 UPDATE한다.
type SaveCompletionResult =
  | { ok: true; completionId: string; dbCourseId: string }
  | { ok: false; reason?: AuthFailureReason };

export async function saveCourseCompletionAction(
  payload: CourseCompletionPayload,
): Promise<SaveCompletionResult> {
  try {
    const authState = await getFreshAuthState();
    if (authState.status !== "authenticated") {
      return { ok: false, reason: authState.status };
    }
    const { session } = authState;

    const parsed = courseCompletionSchema.safeParse(payload);
    if (!parsed.success) return { ok: false };
    const d = parsed.data;

    const completedAt =
      d.status === "abandoned" ? null : new Date(d.completedAt ?? Date.now());

    // ── UPDATE 경로 ────────────────────────────────────────────────────────────
    if (d.completionId && d.dbCourseId) {
      const updated = await db
        .update(courseCompletions)
        .set({
          status: d.status,
          rating: d.rating,
          review: d.reactions.length ? d.reactions.join(", ") : null,
          // 클라이언트가 시작 시각을 모르면(새로고침·다른 기기에서 DB로 복원) 행에 이미
          // 있는 시작 시각을 그대로 둔다 — 완료 시각으로 덮으면 체류 시간이 0분이 된다.
          ...(d.startedAt ? { startedAt: new Date(d.startedAt) } : {}),
          completedAt,
        })
        .where(
          and(
            eq(courseCompletions.id, d.completionId),
            eq(courseCompletions.userId, session.user.id),
            eq(courseCompletions.courseId, d.dbCourseId),
          ),
        )
        .returning({ id: courseCompletions.id });

      // 0행 갱신 — 잘못된 기록 ID나 다른 계정의 로컬 데이터. 저장 성공으로 오인하지 않는다.
      if (updated.length === 0) return { ok: false };
      return { ok: true, completionId: d.completionId, dbCourseId: d.dbCourseId };
    }

    const startedAt = d.startedAt
      ? new Date(d.startedAt)
      : (completedAt ?? new Date());

    // ── INSERT fallback ────────────────────────────────────────────────────────
    // neon-http는 트랜잭션 미지원 → db.batch(단일 HTTP 트랜잭션)로 원자성 확보.
    // batch는 RETURNING 체이닝이 불가하므로 course id를 사전 생성한다.
    const courseId = crypto.randomUUID();
    const completionId = crypto.randomUUID();

    await db.batch([
      db.insert(courses).values({
        id: courseId,
        name: d.courseName,
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
        availabilityUncertain: d.place.availabilityUncertain,
        description: d.place.description || null,
        badgeText: d.place.badgeText || null,
        badgeVariant: d.place.badgeVariant || null,
        placeUrl: d.place.placeUrl || null,
        programInfo: d.place.programInfo ?? null,
        organizerUrl: d.place.organizerUrl ?? null,
      }),
      db.insert(courseCompletions).values({
        id: completionId,
        userId: session.user.id,
        courseId,
        status: d.status,
        rating: d.rating,
        review: d.reactions.length ? d.reactions.join(", ") : null,
        startedAt,
        completedAt,
      }),
    ]);

    return { ok: true, completionId, dbCourseId: courseId };
  } catch (err) {
    console.error("[completion] 저장 실패:", err);
    return { ok: false };
  }
}
