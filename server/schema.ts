import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

// ─── better-auth managed tables ──────────────────────────────────────────────
// Column names must match what better-auth expects (camelCase TS keys, snake_case DB columns).
// Do NOT rename or reorder these without updating the drizzle adapter config.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  // additional fields — synced with betterAuth({ user: { additionalFields } })
  prefTravel: text("pref_travel").notNull().default("walk"),
  prefParty: text("pref_party").notNull().default("solo"),
  prefVibe: text("pref_vibe").notNull().default("quiet"),
  prefFood: text("pref_food").notNull().default("matjip"),
  prefIndoor: text("pref_indoor").notNull().default("indoor"),
  onboardingDone: boolean("onboarding_done").notNull().default(false),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
})

// ─── Cache tables ─────────────────────────────────────────────────────────────

export const apiCache = pgTable("api_cache", {
  cacheKey: text("cache_key").primaryKey(),
  payload:  jsonb("payload").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

// ─── Domain tables ────────────────────────────────────────────────────────────

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    region: text("region").notNull(),       // '서울 마포구' (화면 표시용)
    regionCode: text("region_code").notNull(), // 'seoul-mapo' (필터링용)
    imageSeed: text("image_seed"),
    // TODO: 미사용 컬럼, 차기 마이그레이션에서 제거
    isFestival: boolean("is_festival").notNull().default(false),
    scale: text("scale").notNull(),         // 'light' | 'moderate' | 'leisurely'
    // 취향 필터. NULL = 모든 취향에 적합
    prefTravel: text("pref_travel"),
    prefVibe: text("pref_vibe"),
    prefIndoor: text("pref_indoor"),
    prefParty: text("pref_party"),
    // 집계 (리뷰 제출 시 트랜잭션으로 갱신)
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }).notNull().default("0"),
    reviewCount: integer("review_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_courses_region_scale").on(t.regionCode, t.scale),
  ],
)

export const coursePlaces = pgTable(
  "course_places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    orderIndex: smallint("order_index").notNull(), // 0, 1, 2
    name: text("name").notNull(),
    category: text("category").notNull(),
    address: text("address").notNull(),
    lat: numeric("lat", { precision: 10, scale: 7 }),
    lng: numeric("lng", { precision: 10, scale: 7 }),
    openTime: text("open_time"),    // '09:00'
    closeTime: text("close_time"),  // '22:00'
    closedDays: text("closed_days").array(), // ['월', '화']
    stayMin: smallint("stay_min").notNull(), // 예상 체류 하한(분)
    stayMax: smallint("stay_max").notNull(), // 예상 체류 상한(분)
    // 체류시간 규칙 조인 키 (lib/pipeline/stayDuration.ts의 rule.key). 실측 집계용
    stayDurationKey: text("stay_duration_key"),
    travelToNextMin: smallint("travel_to_next_min"), // 마지막 장소는 NULL
    // 휴무 데이터 불확실 플래그(stage2). 실시간 경로(lib/tour/mappers.ts)와 동일하게 보존한다.
    availabilityUncertain: boolean("availability_uncertain").notNull().default(false),
    description: text("description"),
    badgeText: text("badge_text"),
    badgeVariant: text("badge_variant"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_course_places_course_order").on(t.courseId, t.orderIndex),
  ],
)

export const courseCompletions = pgTable(
  "course_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    status: text("status").notNull().default("active"), // 'active' | 'completed' | 'abandoned'
    currentPlaceIndex: smallint("current_place_index").notNull().default(0),
    rating: smallint("rating"),    // 1–5. 완료 전 NULL
    review: text("review"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    // 출발지→장소 직선거리(m). 이동시간 추정용 — 좌표 원본은 저장하지 않는다
    travelDistM: integer("travel_dist_m"),
    // 위치 도장: [{t: epoch ms, distM: 장소와의 거리 m}]. 진행 화면 재개/제스처/완료 시 기록
    locationStamps: jsonb("location_stamps").$type<{ t: number; distM: number }[]>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_completions_user_created").on(t.userId, t.createdAt),
    index("idx_completions_course_completed").on(t.courseId, t.completedAt),
  ],
)
