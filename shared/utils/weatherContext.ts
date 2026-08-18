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
  tempC: number | null;
};

// 초단기실황/예보는 기온을 T1H로 준다 — TMP는 단기예보(미사용) 전용이라 혼동 주의.
function parseTempC(weather: Record<string, string>): number | null {
  const raw = weather.T1H;
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

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
      tempC: parseTempC(weather),
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

// ─── 날씨 게이트(실외→실내 추천 전환) ────────────────────────────────────────
// lib/pipeline/weatherGate.ts가 쓰는 순수 판정 로직 — 날씨를 "얼마나 나쁜가" 신호로
// 축약할 뿐, 추천 점수 반영은 파이프라인 계층 책임이다.

// 기상청 폭염주의보(일 최고 33℃) 기준 — 공식 특보의 "2일 지속" 요건은 반영 안 된
// 순간값 프록시다.
export const HEATWAVE_THRESHOLD_C = 33;

export function isAdverseWeather(condition: WeatherCondition): boolean {
  return condition === "rain" || condition === "snow";
}

export function isHeatwaveTemp(tempC: number | null): boolean {
  return tempC !== null && tempC >= HEATWAVE_THRESHOLD_C;
}

const CONDITION_SEVERITY: Record<WeatherCondition, number> = {
  clear: 0,
  cloudy: 1,
  rain: 2,
  snow: 3,
};

export type WeatherGateSignal = {
  // 판정 창(now~now+windowHours) 안에서 가장 나쁜 컨디션(snow > rain > cloudy > clear)
  condition: WeatherCondition;
  // 창 안 어느 시점이든 기온이 HEATWAVE_THRESHOLD_C 이상이면 true — condition과
  // 독립적으로 판정한다(맑고 더운 날도 폭염 신호가 떠야 하므로).
  isHeatwave: boolean;
  tempC: number | null; // 현재 실황 기온 — 로그·디버깅용 참고값
  // condition(악화 시) 또는 isHeatwave(그 외) 판정 근거가 된 시점까지 남은 시간(0=지금)
  hoursAhead: number;
};

// 현재 실황+창 안의 예보를 "방문 시점 날씨" 신호 하나로 축약한다(실제 방문 시각을
// 몰라 now~now+windowHours 중 최악값을 쓴다).
export function resolveWeatherGateSignal(
  currentWeather: Record<string, string>,
  forecast: ForecastPoint[],
  now: Date,
  windowHours: number,
): WeatherGateSignal {
  const nowMs = now.getTime();
  const horizonMs = nowMs + windowHours * 60 * 60 * 1000;

  let worstCondition = kmaToWeatherCondition(currentWeather);
  let worstConditionHoursAhead = 0;
  let heatwave = isHeatwaveTemp(parseTempC(currentWeather));
  let heatwaveHoursAhead = 0;

  for (const point of forecast) {
    const pointMs = point.fcstDateTime.getTime();
    if (pointMs <= nowMs || pointMs > horizonMs) continue;
    const hoursAhead = Math.max(1, Math.round((pointMs - nowMs) / (60 * 60 * 1000)));

    if (CONDITION_SEVERITY[point.condition] > CONDITION_SEVERITY[worstCondition]) {
      worstCondition = point.condition;
      worstConditionHoursAhead = hoursAhead;
    }
    if (!heatwave && isHeatwaveTemp(point.tempC)) {
      heatwave = true;
      heatwaveHoursAhead = hoursAhead;
    }
  }

  const isAdverse = isAdverseWeather(worstCondition);
  return {
    condition: worstCondition,
    isHeatwave: heatwave,
    tempC: parseTempC(currentWeather),
    hoursAhead: isAdverse ? worstConditionHoursAhead : heatwaveHoursAhead,
  };
}
