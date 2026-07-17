import type { courses, coursePlaces, courseCompletions } from "@/server/schema";
import type {
  JourneyPlace,
  CourseProgress,
  CompletedCourse,
} from "@/shared/types/course.types";
import { formatDuration } from "@/shared/utils/duration";

// DB row 타입 — schema에서 직접 추론
type CourseRow = typeof courses.$inferSelect;
type PlaceRow = typeof coursePlaces.$inferSelect;
type CompletionRow = typeof courseCompletions.$inferSelect;

// ─── Journey ─────────────────────────────────────────────────────────────────

export function toJourneyPlace(row: PlaceRow): JourneyPlace {
  const duration = { min: row.stayMin, max: row.stayMax };
  return {
    id: row.id,
    cat: row.category,
    name: row.name,
    addr: row.address,
    hours: formatHours(row.openTime, row.closeTime, row.closedDays),
    time: row.openTime ?? "",
    dur: formatDuration(duration),
    badge: {
      text: row.badgeText ?? row.category,
      variant:
        (row.badgeVariant as JourneyPlace["badge"]["variant"]) ?? "secondary",
    },
    desc: row.description ?? "",
    coord:
      row.lat && row.lng
        ? { lat: Number(row.lat), lng: Number(row.lng) }
        : null,
    imageUrl: null,
    availabilityUncertain: row.availabilityUncertain,
    estimatedDuration: duration,
    stayDurationKey: row.stayDurationKey ?? undefined,
    tags: [],
  };
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export function toCourseProgress(
  completion: CompletionRow,
  course: CourseRow,
): CourseProgress {
  return {
    name: course.name,
    region: course.region,
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
    region: course.region,
    duration: "", // 호출부에서 실제 소요 시간 계산
    places: places.map((p) => ({ name: p.name, category: p.category })),
    rating: completion.rating ?? 0,
    review: completion.review ?? "",
  };
}

// ─── 내부 유틸 ────────────────────────────────────────────────────────────────

function formatHours(
  open: string | null,
  close: string | null,
  closedDays: string[] | null,
): string {
  if (!open || !close) return "정보 없음";
  const days = closedDays?.length ? ` (${closedDays.join("·")} 휴무)` : "";
  return `${open} ~ ${close}${days}`;
}

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
