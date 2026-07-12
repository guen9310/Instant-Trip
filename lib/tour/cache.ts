import { getCached, setCached, setCachedEmpty } from "@/lib/cache/dbCache";
export { CACHE_EMPTY } from "@/lib/cache/dbCache";
export type { CacheEmpty } from "@/lib/cache/dbCache";
import type { CacheEmpty } from "@/lib/cache/dbCache";

export async function readCache<T>(key: string): Promise<T | CacheEmpty | null> {
  return getCached<T>(key);
}

export async function writeCache<T>(
  key: string,
  data: T,
  ttlSeconds: number,
): Promise<void> {
  return setCached(key, data, ttlSeconds);
}

export async function writeCacheEmpty(
  key: string,
  ttlSeconds: number,
): Promise<void> {
  return setCachedEmpty(key, ttlSeconds);
}
