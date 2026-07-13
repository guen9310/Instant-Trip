function kstParts(now: Date, options: Omit<Intl.DateTimeFormatOptions, "timeZone">) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "Asia/Seoul" }).formatToParts(now);
}

export function getKstHour(now: Date = new Date()): number {
  const parts = kstParts(now, { hourCycle: "h23", hour: "2-digit" });
  return parseInt(parts.find((p) => p.type === "hour")!.value, 10);
}

export function getKstMinute(now: Date = new Date()): number {
  const parts = kstParts(now, { minute: "2-digit" });
  return parseInt(parts.find((p) => p.type === "minute")!.value, 10);
}

// Returns 0=Sunday … 6=Saturday, matching Date.prototype.getDay() semantics
export function getKstDay(now: Date = new Date()): number {
  const parts = kstParts(now, { weekday: "long" });
  const weekday = parts.find((p) => p.type === "weekday")!.value;
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return DAYS.indexOf(weekday);
}

// Returns "YYYY-MM-DD" in KST
export function getKstDateString(now: Date = new Date()): string {
  const parts = kstParts(now, { year: "numeric", month: "2-digit", day: "2-digit" });
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

// Returns "YYYYMMDD" in KST — Tour API eventStartDate 파라미터 전용
export function getKstDateYYYYMMDD(now: Date = new Date()): string {
  return getKstDateString(now).replace(/-/g, "");
}
