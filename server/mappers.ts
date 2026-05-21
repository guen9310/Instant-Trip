import type { courses, coursePlaces, courseCompletions } from "@/server/schema";
import type { FeedCourse, FeedPlace } from "@/shared/types/feed.types";
import type { JourneyPlace, CourseProgress, CompletedCourse } from "@/shared/types/course.types";

// DB row 타입 — schema에서 직접 추론
type CourseRow = typeof courses.$inferSelect;
type PlaceRow = typeof coursePlaces.$inferSelect;
type CompletionRow = typeof courseCompletions.$inferSelect;

// ─── Feed ────────────────────────────────────────────────────────────────────

export function toFeedPlace(row: PlaceRow): FeedPlace {
  return {
    name: row.name,
    category: row.category,
    status: isPlaceOpen(row) ? "open" : "closed",
    description: row.description ?? undefined,
  };
}

export function toFeedCourse(row: CourseRow, places: PlaceRow[]): FeedCourse {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    rating: Number(row.ratingAvg),
    count: row.reviewCount,
    availability: deriveAvailability(places),
    festival: row.isFestival,
    imageSeed: row.imageSeed ?? undefined,
    places: places.map(toFeedPlace),
  };
}

// ─── Journey ─────────────────────────────────────────────────────────────────

export function toJourneyPlace(row: PlaceRow): JourneyPlace {
  return {
    id: row.id,
    cat: row.category,
    name: row.name,
    addr: row.address,
    hours: formatHours(row.openTime, row.closeTime, row.closedDays),
    time: row.openTime ?? "",
    dur: `${row.durationMin}분`,
    travel: row.travelToNextMin ? `이동 ${row.travelToNextMin}분` : "",
    badge: {
      text: row.badgeText ?? row.category,
      variant: (row.badgeVariant as JourneyPlace["badge"]["variant"]) ?? "secondary",
    },
    desc: row.description ?? "",
  };
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export function toCourseProgress(
  completion: CompletionRow,
  course: CourseRow,
): CourseProgress {
  return {
    name: course.name,
    current: completion.currentPlaceIndex + 1,
    total: 0, // 호출부에서 places.length로 채워야 함
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

function isPlaceOpen(row: PlaceRow): boolean {
  if (!row.openTime || !row.closeTime) return true;
  const now = new Date();
  const [oh, om] = row.openTime.split(":").map(Number);
  const [ch, cm] = row.closeTime.split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= oh * 60 + om && cur <= ch * 60 + cm;
}

function deriveAvailability(places: PlaceRow[]): FeedCourse["availability"] {
  const closedCount = places.filter((p) => !isPlaceOpen(p)).length;
  if (closedCount === 0) return "available";
  if (closedCount === places.length) return "unavailable";
  return "partial";
}

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
    .toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
    .replace(/\. /g, ".")
    .replace(/\.$/, "");
}
