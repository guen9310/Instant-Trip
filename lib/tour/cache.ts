import fs from "fs";
import path from "path";
import { isCacheEnabled } from "@/lib/config";

const CACHE_DIR = path.resolve(process.cwd(), "cache");

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cachePath(key: string): string {
  return path.join(CACHE_DIR, `${key}.json`);
}

interface CacheEntry<T> {
  savedAt: number;
  data: T;
}

export function readCache<T>(key: string, ttlMs: number): T | null {
  if (!isCacheEnabled()) return null;
  const file = cachePath(key);
  if (!fs.existsSync(file)) return null;
  try {
    const entry = JSON.parse(fs.readFileSync(file, "utf-8")) as CacheEntry<T>;
    if (Date.now() - entry.savedAt > ttlMs) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  if (!isCacheEnabled()) return;
  try {
    ensureCacheDir();
    const entry: CacheEntry<T> = { savedAt: Date.now(), data };
    fs.writeFileSync(cachePath(key), JSON.stringify(entry));
  } catch (err) {
    console.warn(`[cache] 저장 실패 (${key}): ${err}`);
  }
}
