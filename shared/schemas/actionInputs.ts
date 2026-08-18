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

export const weatherForecastAlertInputSchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
  // 초단기예보 제공 범위(발표시각 기준 최대 6시간)를 상한으로 둔다.
  windowHours: z.number().int().min(1).max(6),
});

export const generateCourseInputSchema = z.object({
  mapX: longitudeSchema,
  mapY: latitudeSchema,
  scale: z.enum(["light", "moderate", "leisurely"]),
  prefs: prefsSchema,
  // 재추천은 최대 3회, 반경 확장은 서비스의 최대 탐색 반경인 20km까지 허용한다.
  excludeIds: z.array(z.string().min(1).max(200)).max(3).optional(),
  radiusM: z.number().int().min(1_000).max(20_000).optional(),
  // "너무 멀어요" 거절 리롤 전용 — 방금 거절한 장소보다 가까운 후보만 남긴다.
  // 서비스 최대 탐색 반경(20km)을 상한으로 둔다.
  maxDistanceKm: z.number().positive().max(20).optional(),
  // "시간이 안 맞아요" 거절 리롤 전용 — no_data/uncertain도 채택하는 기본 게이트 대신
  // 실측으로 "open"이 확인된 후보만 채택한다.
  strictOpenOnly: z.boolean().optional(),
  // 데모/QA 전용 — 실제 기상청 API 대신 날씨 게이트(lib/pipeline/weatherGate.ts)를
  // 강제 트리거한다. 서버 액션(app/actions/course.ts)이 WEATHER_GATE_DEBUG_ENABLED
  // 환경변수가 켜져 있을 때만 실제로 반영하고, 그 외엔 파싱만 되고 무시된다.
  debugWeather: z.enum(["clear", "cloudy", "rain", "snow", "heatwave"]).optional(),
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
