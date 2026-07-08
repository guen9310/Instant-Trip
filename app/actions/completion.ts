"use server";

import { db } from "@/server/db";
import { courses, coursePlaces, courseCompletions } from "@/server/schema";
import { getSession } from "@/server/session";
import {
  courseCompletionSchema,
  type CourseCompletionPayload,
} from "@/shared/schemas/courseCompletion";

// 완료/포기 기록 저장 — 텔레메트리 등급. 어떤 실패도 사용자 흐름으로 전파하지 않는다(조용히 skip).
// completed: 완료 버튼 시점. abandoned: 새 코스 시작으로 이전 코스 포기가 확정된 시점.
export async function saveCourseCompletionAction(
  payload: CourseCompletionPayload,
): Promise<{ ok: boolean }> {
  try {
    const session = await getSession();
    if (!session?.user) return { ok: false }; // 비로그인 — 기록 없이 skip

    const parsed = courseCompletionSchema.safeParse(payload);
    if (!parsed.success) return { ok: false };
    const d = parsed.data;

    // neon-http는 트랜잭션 미지원 → db.batch(단일 HTTP 트랜잭션)로 원자성 확보.
    // batch는 RETURNING 체이닝이 불가하므로 course id를 사전 생성한다.
    const courseId = crypto.randomUUID();
    // abandoned는 완료 시각이 존재하지 않으므로 NULL 유지
    const completedAt =
      d.status === "abandoned" ? null : new Date(d.completedAt ?? Date.now());
    // startedAt 유실(새로고침 등) 시 completedAt과 동일하게 저장 — 집계 시 0-duration으로 필터
    const startedAt = d.startedAt
      ? new Date(d.startedAt)
      : (completedAt ?? new Date());

    await db.batch([
      db.insert(courses).values({
        id: courseId,
        name: d.courseName,
        region: d.region ?? "알 수 없음",
        regionCode: d.region ?? "unknown", // slug 체계 도입 전 임시로 표시명 저장
        scale: d.scale,
        isActive: false, // 측정용 행 — 피드 노출 방지
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
    return { ok: true };
  } catch (err) {
    console.error("[completion] 저장 실패:", err);
    return { ok: false };
  }
}
