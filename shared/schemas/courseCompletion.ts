import { z } from "zod";

// 완료 기록 저장 페이로드 — 측정 전용 UI 없이, 이미 발생한 이벤트(시작/완료 버튼)의
// 타임스탬프만 서버로 보낸다. 검증 실패는 저장 skip일 뿐 완료 UX를 막지 않는다.
export const courseCompletionSchema = z.object({
  courseName: z.string().min(1),
  scale: z.enum(["light", "moderate", "leisurely"]).default("moderate"),
  // completed = 완료 버튼, abandoned = 새 코스 시작으로 이전 코스 포기가 확정된 경우
  status: z.enum(["completed", "abandoned"]).default("completed"),
  // startCourseAction이 생성한 DB row ID — 있으면 UPDATE, 없으면 INSERT fallback
  completionId: z.string().optional(),
  dbCourseId: z.string().optional(),
  place: z
    .object({
      name: z.string().min(1),
      category: z.string().min(1),
      address: z.string(),
      coord: z.object({ lat: z.number(), lng: z.number() }).nullable(),
      stayMin: z.number().int().positive(),
      stayMax: z.number().int().positive(),
      availabilityUncertain: z.boolean().default(false),
      description: z.string().default(""),
      badgeText: z.string().default(""),
      badgeVariant: z.string().default("secondary"),
      placeUrl: z.string().nullable().default(null),
      programInfo: z
        .object({ main: z.string(), extra: z.array(z.string()) })
        .nullable()
        .default(null),
      organizerUrl: z.string().nullable().default(null),
    })
    .refine((p) => p.stayMin <= p.stayMax, {
      message: "stayMin은 stayMax 이하여야 한다",
    }),
  startedAt: z.number().int().positive().nullable(), // epoch ms
  completedAt: z.number().int().positive().nullable(), // epoch ms
  rating: z.number().int().min(1).max(5).nullable(),
  reactions: z.array(z.string()).max(10).default([]),
});

export type CourseCompletionPayload = z.input<typeof courseCompletionSchema>;
