-- api_cache: Tour API / 축제 API 응답을 저장하는 서버리스 호환 캐시 테이블
-- 적용 방법: pnpm db:push  또는  psql $DATABASE_URL -f drizzle/0001_api_cache.sql

CREATE TABLE IF NOT EXISTS "api_cache" (
  "cache_key"  text        PRIMARY KEY,
  "payload"    jsonb       NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
