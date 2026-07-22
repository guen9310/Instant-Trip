import type { courses, coursePlaces, courseCompletions } from "@/server/schema";
import type {
  CourseProgress,
  CompletedCourse,
  BadgeVariant,
} from "@/shared/types/course.types";

// DB row 타입 — schema에서 직접 추론
type CourseRow = typeof courses.$inferSelect;
type PlaceRow = typeof coursePlaces.$inferSelect;
type CompletionRow = typeof courseCompletions.$inferSelect;

// ─── Profile ─────────────────────────────────────────────────────────────────

export function toCourseProgress(
  completion: CompletionRow,
  course: CourseRow,
): CourseProgress {
  return {
    name: course.name,
    courseId: course.id,
  };
}

export function toCompletedCourse(
  completion: CompletionRow,
  course: CourseRow,
  places: PlaceRow[],
): CompletedCourse {
  return {
    id: completion.id,
    name: course.name,
    date: formatDate(completion.completedAt),
    duration: "", // 호출부에서 실제 소요 시간 계산
    places: places.map((p) => ({
      name: p.name,
      category: p.category,
      address: p.address,
      description: p.description ?? "",
      badge: {
        text: p.badgeText ?? p.category,
        variant: (p.badgeVariant as BadgeVariant) ?? "secondary",
      },
      availabilityUncertain: p.availabilityUncertain,
      coord:
        p.lat && p.lng ? { lat: Number(p.lat), lng: Number(p.lng) } : null,
    })),
    rating: completion.rating ?? 0,
    review: completion.review ?? "",
  };
}

// ─── 내부 유틸 ────────────────────────────────────────────────────────────────

function formatDate(date: Date | null): string {
  if (!date) return "";
  return date
    .toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\. /g, ".")
    .replace(/\.$/, "");
}
