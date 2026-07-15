import { haversineM } from "@/shared/utils/geo";
import type { PendingCourse } from "@/shared/types/course.types";
import type { CourseCompletionPayload } from "@/shared/schemas/courseCompletion";

// pendingCourse + 진행 타임스탬프 → 완료/포기 기록 페이로드.
// 실제 추천 데이터가 없으면(estimatedDuration/courseName 누락) null — mock은 기록하지 않는다.
export function buildCompletionPayload(args: {
  pending: Partial<PendingCourse> | null;
  status: "completed" | "abandoned";
  startedAt: number | null;
  completedAt: number | null;
  rating?: number | null;
  reactions?: string[];
  stamps?: { t: number; distM: number }[];
}): CourseCompletionPayload | null {
  const p = args.pending?.place;
  if (!p?.estimatedDuration || !args.pending?.courseName) return null;

  // 출발지→장소 직선거리 — 이동시간 추정 재료. 좌표 원본은 보내지 않는다
  const travelDistM =
    p.coord && args.pending.mapX != null && args.pending.mapY != null
      ? haversineM(args.pending.mapY, args.pending.mapX, p.coord.lat, p.coord.lng)
      : null;

  // 구버전 localStorage의 임의 문자열 방어 — 유효하지 않으면 moderate로 폴백
  const s = args.pending.scale;
  const scale =
    s === "light" || s === "moderate" || s === "leisurely" ? s : "moderate";

  return {
    courseName: args.pending.courseName,
    region: args.pending.region,
    scale,
    status: args.status,
    completionId: args.pending.completionId,
    dbCourseId: args.pending.dbCourseId,
    place: {
      name: p.name,
      category: p.cat,
      address: p.addr,
      coord: p.coord,
      stayMin: p.estimatedDuration.min,
      stayMax: p.estimatedDuration.max,
      stayDurationKey: p.stayDurationKey,
      availabilityUncertain: p.availabilityUncertain,
      description: p.desc,
      badgeText: p.badge.text,
      badgeVariant: p.badge.variant,
    },
    startedAt: args.startedAt,
    completedAt: args.completedAt,
    rating: args.rating ?? null,
    reactions: args.reactions ?? [],
    travelDistM,
    stamps: args.stamps ?? [],
  };
}
