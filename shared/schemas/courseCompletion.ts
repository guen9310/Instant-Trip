import { z } from "zod";

// 완료 기록 저장 페이로드 — 측정 전용 UI 없이, 이미 발생한 이벤트(시작/완료 버튼)의
// 타임스탬프만 서버로 보낸다. 검증 실패는 저장 skip일 뿐 완료 UX를 막지 않는다.
export const courseCompletionSchema = z.object({
  courseName: z.string().min(1),
  region: z.string().optional(),
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
      // 체류시간 규칙 조인 키 (구버전 localStorage 페이로드엔 없을 수 있음)
      stayDurationKey: z.string().optional(),
      availabilityUncertain: z.boolean().default(false),
      description: z.string().default(""),
      badgeText: z.string().default(""),
      badgeVariant: z.string().default("secondary"),
    })
    .refine((p) => p.stayMin <= p.stayMax, {
      message: "stayMin은 stayMax 이하여야 한다",
    }),
  startedAt: z.number().int().positive().nullable(), // epoch ms
  completedAt: z.number().int().positive().nullable(), // epoch ms
  rating: z.number().int().min(1).max(5).nullable(),
  reactions: z.array(z.string()).max(10).default([]),
  // 출발지→장소 직선거리(m)
  travelDistM: z.number().int().nonnegative().nullable().default(null),
  // 위치 도장: 진행 화면 재개/완료 순간의 (시각, 장소와의 거리 m)
  stamps: z
    .array(z.object({ t: z.number().int().positive(), distM: z.number().int().nonnegative() }))
    .max(100)
    .default([]),
});

export type CourseCompletionPayload = z.input<typeof courseCompletionSchema>;
