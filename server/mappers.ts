import type { courses, coursePlaces, courseCompletions } from "@/server/schema";
import type {
  CourseProgress,
  CompletedCourse,
  BadgeVariant,
  JourneyPlace,
} from "@/shared/types/course.types";
import { formatDuration, type DurationRange } from "@/shared/utils/duration";
import { getKstDateString } from "@/shared/utils/kst";

// DB row 타입 — schema에서 직접 추론
type CourseRow = typeof courses.$inferSelect;
type PlaceRow = typeof coursePlaces.$inferSelect;
type CompletionRow = typeof courseCompletions.$inferSelect;

// ─── Profile ─────────────────────────────────────────────────────────────────

// 장소 간 이동에 드는 시간의 러프한 추정치(분) — 실제 경로/거리 데이터 없이
// "장소 수 - 1"번의 이동이 있다고 가정하고 각각 이 정도는 걸린다고 본다.
const TRAVEL_BUFFER_MIN_PER_HOP = 15;

export function toCourseProgress(
  completion: CompletionRow,
  course: CourseRow,
  places: PlaceRow[],
): CourseProgress {
  const totalStayMax = places.reduce((sum, p) => sum + p.stayMax, 0);
  const travelBuffer = Math.max(0, places.length - 1) * TRAVEL_BUFFER_MIN_PER_HOP;
  const expectedMin = totalStayMax + travelBuffer;
  const elapsedMin = (Date.now() - completion.startedAt.getTime()) / 60000;

  return {
    name: course.name,
    courseId: course.id,
    // 장소 데이터가 없으면(비정상 상태) 판단할 근거가 없으니 false로 둔다 —
    // 오탐(완료했는데 계속 진행 중으로 뜨는 것)보다 미탐이 안전한 기본값이다.
    likelyForgotten: places.length > 0 && elapsedMin > expectedMin,
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
      programInfo: p.programInfo,
      organizerUrl: p.organizerUrl,
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
    programInfo: place.programInfo,
    organizerUrl: place.organizerUrl,
  };
}

// ─── 내부 유틸 ────────────────────────────────────────────────────────────────

function formatDate(date: Date | null): string {
  if (!date) return "";
  // 서버 런타임 타임존(프로덕션은 UTC)에 의존하지 않고 항상 KST 기준으로
  // 포맷한다 — 프로젝트 표준 방식(shared/utils/kst.ts)과 통일.
  return getKstDateString(date).replace(/-/g, ".");
}
