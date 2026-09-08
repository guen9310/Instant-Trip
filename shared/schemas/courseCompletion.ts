import { z } from "zod";

// 코스 시작 시 DB insert 페이로드 — startCourseAction(app/actions/completion.ts).
// CourseResultView가 JourneyPlace(shared/types/course.types.ts)를 그대로 넘기므로
// 필드명이 아래 courseCompletionSchema의 place와 다르다(cat/addr/desc/badge vs
// category/address/description/badgeText+badgeVariant) — DB insert에 실제로 쓰는
// 필드만 검증한다. JourneyPlace의 다른 필드(topPreferenceTag, origin 등)는 여기서
// 쓰이지 않으므로 안 실어도 safeParse가 그냥 제거한다(strict 아님).
export const startCourseInputSchema = z.object({
  courseName: z.string().min(1),
  scale: z.enum(["light", "moderate", "leisurely"]),
  place: z
    .object({
      name: z.string().min(1),
      cat: z.string().min(1),
      addr: z.string(),
      coord: z.object({ lat: z.number(), lng: z.number() }).nullable(),
      estimatedDuration: z.object({
        min: z.number().int().positive(),
        max: z.number().int().positive(),
      }),
      availabilityUncertain: z.boolean(),
      desc: z.string(),
      badge: z.object({ text: z.string(), variant: z.string() }),
      placeUrl: z.string().optional(),
      programInfo: z
        .object({ main: z.string(), extra: z.array(z.string()) })
        .nullable()
        .optional(),
      organizerUrl: z.string().nullable().optional(),
    })
    .refine((p) => p.estimatedDuration.min <= p.estimatedDuration.max, {
      message: "estimatedDuration.min은 max 이하여야 한다",
    }),
});

export type StartCourseInput = z.infer<typeof startCourseInputSchema>;

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
