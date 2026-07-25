import type { courses, coursePlaces, courseCompletions } from "@/server/schema";
import type {
  CourseProgress,
  CompletedCourse,
  BadgeVariant,
  JourneyPlace,
} from "@/shared/types/course.types";
import { formatDuration, type DurationRange } from "@/shared/utils/duration";

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
      placeUrl: p.placeUrl,
    })),
    rating: completion.rating ?? 0,
    review: completion.review ?? "",
  };
}

// ─── 진행 중인 외출 이어보기(DB fallback) ────────────────────────────────────

// course_places에는 hours/imageUrl/tags가 없다(생성 당시 추천 카드에만 있던 부가 정보라
// DB엔 저장하지 않음) — 빈 값으로 채운다. CourseActiveView는 이 필드들을 이미 null-safe로 다룬다.
export function toJourneyPlace(place: PlaceRow): JourneyPlace {
  const estimatedDuration: DurationRange = { min: place.stayMin, max: place.stayMax };
  return {
    id: place.id,
    cat: place.category,
    name: place.name,
    addr: place.address,
    hours: "",
    time: "",
    dur: formatDuration(estimatedDuration),
    badge: {
      text: place.badgeText ?? place.category,
      variant: (place.badgeVariant as BadgeVariant) ?? "secondary",
    },
    desc: place.description ?? "",
    coord:
      place.lat && place.lng
        ? { lat: Number(place.lat), lng: Number(place.lng) }
        : null,
    imageUrl: null,
    availabilityUncertain: place.availabilityUncertain,
    estimatedDuration,
    tags: [],
    placeUrl: place.placeUrl ?? undefined,
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
