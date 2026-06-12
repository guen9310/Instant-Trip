let _cacheEnabled = true;

export function isCacheEnabled(): boolean {
  return _cacheEnabled;
}

export function setCacheEnabled(v: boolean): void {
  _cacheEnabled = v;
}
