// Vercel 서버리스 환경에서 파일시스템 캐시는 동작하지 않으므로 no-op으로 대체.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function readCache<T>(_key: string, _ttlMs: number): T | null {
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function writeCache<T>(_key: string, _data: T): void {
  // no-op
}
