import { z } from "zod";

const latitudeSchema = z.number().finite().min(-90).max(90);
const longitudeSchema = z.number().finite().min(-180).max(180);

const prefsSchema = z.object({
  travel: z.enum(["walk", "min"]),
  party: z.enum(["solo", "group"]),
  vibe: z.enum(["quiet", "lively"]),
  food: z.enum(["matjip", "any"]),
  indoor: z.enum(["indoor", "outdoor"]),
});

export const homeLocationInputSchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
  city: z.string().trim().min(1).max(100),
  sidoName: z.string().trim().min(1).max(100).nullable().optional(),
});

export const homeRegionInputSchema = z.object({
  regionName: z.string().trim().min(1).max(100),
});

export const nearbyPoisInputSchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
});

export const generateCourseInputSchema = z.object({
  mapX: longitudeSchema,
  mapY: latitudeSchema,
  scale: z.enum(["light", "moderate", "leisurely"]),
  prefs: prefsSchema,
  // 재추천은 최대 3회, 반경 확장은 서비스의 최대 탐색 반경인 20km까지 허용한다.
  excludeIds: z.array(z.string().min(1).max(200)).max(3).optional(),
  radiusM: z.number().int().min(1_000).max(20_000).optional(),
});

export const generateCourseFromPlaceInputSchema = z.object({
  contentId: z.string().trim().min(1).max(100),
  contentTypeId: z.string().regex(/^\d{1,5}$/),
  lat: latitudeSchema,
  lng: longitudeSchema,
});

export const generateCourseFromFestivalInputSchema = z.object({
  id: z.string().trim().min(1).max(300),
  name: z.string().trim().min(1).max(300),
  status: z.enum(["ongoing", "upcoming"]),
  period: z.string().max(100),
  address: z.string().max(500),
  imageUrl: z.string().max(2_000).nullable(),
  description: z.string().max(10_000).nullable(),
  contentId: z.string().trim().min(1).max(100).nullable(),
  lat: latitudeSchema,
  lng: longitudeSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((festival) => festival.startDate <= festival.endDate, {
  message: "startDate는 endDate 이하여야 합니다",
  path: ["endDate"],
});
