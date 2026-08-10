import type { WeatherItem } from "@/shared/types/weather.types";
import { parseKstDateTime } from "@/shared/utils/kst";

export type WeatherCondition = "clear" | "cloudy" | "rain" | "snow";

// PTY(강수형태) 우선, SKY(하늘상태)는 초단기예보에서만 제공됨
export function kmaToWeatherCondition(
  weather: Record<string, string>,
): WeatherCondition {
  const pty = weather.PTY ?? "0";
  if (pty === "3" || pty === "7") return "snow";
  if (pty !== "0") return "rain";
  const sky = weather.SKY;
  if (sky === "3" || sky === "4") return "cloudy";
  return "clear";
}

export type ForecastPoint = {
  fcstDateTime: Date;
  condition: WeatherCondition;
};

// 초단기예보 원본(WeatherItem[], category별 fcstDate+fcstTime 단위로 흩어져 있음)을
// 시각별 컨디션 리스트로 정리한다 — 시간 오름차순 정렬.
export function groupForecastByTime(items: WeatherItem[]): ForecastPoint[] {
  const byTime = new Map<string, Record<string, string>>();
  for (const item of items) {
    if (!item.fcstDate || !item.fcstTime) continue;
    const key = `${item.fcstDate}${item.fcstTime}`;
    const bucket = byTime.get(key) ?? {};
    bucket[item.category] = item.fcstValue ?? "";
    byTime.set(key, bucket);
  }
  return Array.from(byTime.entries())
    .map(([key, weather]) => ({
      fcstDateTime: parseKstDateTime(key.slice(0, 8), key.slice(8, 12)),
      condition: kmaToWeatherCondition(weather),
    }))
    .sort((a, b) => a.fcstDateTime.getTime() - b.fcstDateTime.getTime());
}

export type WeatherForecastAlert = {
  condition: WeatherCondition;
  hoursAhead: number;
};

// windowHours 이내에 currentCondition과 달라지는 첫 시점을 찾는다 — 방향(호전/악화)은
// 가리지 않는다("비 → 흐림"도 안내 대상). 예보가 전부 currentCondition과 같으면(즉
// "변화"가 없으면) null.
export function findUpcomingWeatherChange(
  forecast: ForecastPoint[],
  now: Date,
  currentCondition: WeatherCondition,
  windowHours: number,
): WeatherForecastAlert | null {
  const nowMs = now.getTime();
  const horizonMs = nowMs + windowHours * 60 * 60 * 1000;

  for (const point of forecast) {
    const pointMs = point.fcstDateTime.getTime();
    if (pointMs <= nowMs) continue;
    if (pointMs > horizonMs) break;
    if (point.condition !== currentCondition) {
      const hoursAhead = Math.max(1, Math.round((pointMs - nowMs) / (60 * 60 * 1000)));
      return { condition: point.condition, hoursAhead };
    }
  }
  return null;
}
