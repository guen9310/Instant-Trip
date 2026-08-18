import type { WeatherItem, GridXY } from "@/shared/types/weather.types";
import { getCached, setCached, setCachedEmpty, CACHE_EMPTY } from "@/lib/cache/dbCache";
import { TTL } from "@/lib/cache/ttl";
import {
  kmaToWeatherCondition,
  groupForecastByTime,
  findUpcomingWeatherChange,
  resolveWeatherGateSignal,
  type WeatherForecastAlert,
  type WeatherGateSignal,
} from "@/shared/utils/weatherContext";

export type { WeatherItem, GridXY };

const WEATHER_BASE_URL =
  "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";

// ─── 상수 ────────────────────────────────────────────────────────────────────

export const CATEGORY_LABEL: Record<string, string> = {
  T1H: "기온(°C)",
  TMP: "기온(°C)",
  TMN: "최저기온(°C)",
  TMX: "최고기온(°C)",
  RN1: "1시간강수량(mm)",
  PCP: "1시간강수량(mm)",
  SNO: "1시간신적설(cm)",
  SKY: "하늘상태",
  PTY: "강수형태",
  LGT: "낙뢰",
  UUU: "동서바람성분(m/s)",
  VVV: "남북바람성분(m/s)",
  VEC: "풍향(deg)",
  WSD: "풍속(m/s)",
  REH: "습도(%)",
  WAV: "파고(m)",
  POP: "강수확률(%)",
};

export const SKY_LABEL: Record<string, string> = {
  "1": "맑음",
  "3": "구름많음",
  "4": "흐림",
};

export const PTY_LABEL: Record<string, string> = {
  "0": "없음",
  "1": "비",
  "2": "비/눈",
  "3": "눈",
  "5": "빗방울",
  "6": "빗방울눈날림",
  "7": "눈날림",
};

// ─── 격자 변환 ───────────────────────────────────────────────────────────────

// 기상청 공식 알고리즘 — WGS84 위경도 → 5km 격자(nx, ny)
export function latlngToGrid(lat: number, lng: number): GridXY {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;

  const DEGRAD = Math.PI / 180;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn =
    Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
    Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  const ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  const r = (re * sf) / Math.pow(ra, sn);
  let theta = lng * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(r * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - r * Math.cos(theta) + YO + 0.5),
  };
}

// ─── HTTP 유틸 ───────────────────────────────────────────────────────────────

type KmaApiResponse<T> = {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: {
      dataType: string;
      items: { item: T | T[] } | "";
      pageNo: number;
      numOfRows: number;
      totalCount: number;
    };
  };
};

function maskedUrl(url: string): string {
  return url.replace(/serviceKey=[^&]+/, "serviceKey=***");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function extractWeatherItems<T>(response: KmaApiResponse<T>): T[] {
  const items = response.response?.body?.items;
  if (!items || typeof items === "string") return [];
  if (!Array.isArray(items.item)) return items.item ? [items.item as T] : [];
  return items.item;
}

async function weatherFetch<T>(
  endpoint: string,
  params: Record<string, string | number>,
  retryCount = 0,
): Promise<KmaApiResponse<T>> {
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "WEATHER_API_KEY가 없습니다. .env 파일에 키를 입력해주세요.\n" +
        "공공데이터포털 → 기상청_단기예보 조회서비스 → 일반 인증키(Decoding) 복사",
    );
  }

  const searchParams = new URLSearchParams({
    serviceKey: apiKey,
    dataType: "JSON",
    numOfRows: "1000",
    pageNo: "1",
    ...Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ),
  });

  const url = `${WEATHER_BASE_URL}/${endpoint}?${searchParams}`;
  const safe = maskedUrl(url);
  const attempt = retryCount + 1;

  let httpStatus: number | null = null;
  let rawBody: string | null = null;

  try {
    const res = await fetch(url);
    httpStatus = res.status;

    if (!res.ok) {
      rawBody = await res.text().catch(() => "(본문 읽기 실패)");
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const text = await res.text();
    rawBody = text;

    if (text.trimStart().startsWith("<")) {
      const codeMatch = text.match(
        /<returnReasonCode>(.*?)<\/returnReasonCode>/,
      );
      const msgMatch = text.match(/<returnAuthMsg>(.*?)<\/returnAuthMsg>/);
      throw new Error(
        `API XML 에러: ${codeMatch?.[1] ?? "unknown"} — ${msgMatch?.[1] ?? text.slice(0, 200)}`,
      );
    }

    const data = JSON.parse(text) as KmaApiResponse<T>;
    const resultCode = data.response?.header?.resultCode;
    if (resultCode !== "00") {
      throw new Error(
        `API resultCode ${resultCode} — ${data.response?.header?.resultMsg}`,
      );
    }

    return data;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    if (retryCount === 0) {
      console.warn(
        `[weather] ⚠ ${endpoint} (시도 ${attempt})\n` +
          `  URL  : ${safe}\n` +
          `  HTTP : ${httpStatus ?? "연결 실패"}\n` +
          `  원인 : ${errMsg}` +
          (rawBody && !rawBody.startsWith('{"response"')
            ? `\n  응답 : ${rawBody.slice(0, 300)}`
            : ""),
      );
      console.warn(`[weather] 1초 후 재시도...`);
      await sleep(1000);
      return weatherFetch(endpoint, params, retryCount + 1);
    }

    console.error(
      `[weather] ✗ ${endpoint} 최종 실패 (시도 ${attempt})\n` +
        `  URL  : ${safe}\n` +
        `  HTTP : ${httpStatus ?? "연결 실패"}\n` +
        `  원인 : ${errMsg}`,
    );
    throw err;
  }
}

// ─── 날짜·시각 헬퍼 (KST 기준) ───────────────────────────────────────────────
// 기상청 API는 KST(UTC+9) 기준 날짜·시각을 요구함.
// toKST()로 +9h 시프트한 뒤 getUTC*/setUTC* 메서드를 사용해 서버 로컬 타임존 영향을 차단.

function toKST(d: Date): Date {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000);
}

function toDateStr(kst: Date): string {
  return kst.toISOString().slice(0, 10).replace(/-/g, "");
}

function toTimeStr(kst: Date): string {
  return (
    kst.getUTCHours().toString().padStart(2, "0") +
    kst.getUTCMinutes().toString().padStart(2, "0")
  );
}

// 매시 정각 발표, 40분 이후부터 유효
function getNcstBaseTime(now: Date): { base_date: string; base_time: string } {
  const kst = toKST(now);
  if (kst.getUTCMinutes() < 40) kst.setTime(kst.getTime() - 60 * 60 * 1000);
  kst.setUTCMinutes(0, 0, 0);
  return { base_date: toDateStr(kst), base_time: toTimeStr(kst) };
}

// 매시 30분 발표, 45분 이후부터 유효
function getSrtFcstBaseTime(now: Date): {
  base_date: string;
  base_time: string;
} {
  const kst = toKST(now);
  if (kst.getUTCMinutes() < 45) kst.setTime(kst.getTime() - 60 * 60 * 1000);
  kst.setUTCMinutes(30, 0, 0);
  return { base_date: toDateStr(kst), base_time: toTimeStr(kst) };
}

// 0200·0500·0800·1100·1400·1700·2000·2300 발표, 10분 이후부터 유효
function getVilageFcstBaseTime(now: Date): {
  base_date: string;
  base_time: string;
} {
  const ISSUE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23];
  const kst = toKST(now);
  const h = kst.getUTCHours();
  const m = kst.getUTCMinutes();

  let baseHour = ISSUE_HOURS[0];
  for (const ih of ISSUE_HOURS) {
    if (h > ih || (h === ih && m >= 10)) baseHour = ih;
  }
  if (h < 2 || (h === 2 && m < 10)) {
    kst.setTime(kst.getTime() - 24 * 60 * 60 * 1000);
    baseHour = 23;
  }

  kst.setUTCHours(baseHour, 0, 0, 0);
  return { base_date: toDateStr(kst), base_time: toTimeStr(kst) };
}

// ─── 공개 API ────────────────────────────────────────────────────────────────

export async function getUltraSrtNcst(
  nx: number,
  ny: number,
  now: Date = new Date(),
): Promise<WeatherItem[]> {
  const { base_date, base_time } = getNcstBaseTime(now);
  // 5km 격자(nx, ny) + 발표시각 단위 캐시 — 같은 격자 안 모든 사용자가 같은 시간대엔
  // 동일한 실황값을 받으므로, 사용자별이 아니라 격자별로 캐시한다.
  const cacheKey = `weather:ncst:${nx}:${ny}:${base_date}:${base_time}`;

  const cached = await getCached<WeatherItem[]>(cacheKey);
  if (cached === CACHE_EMPTY) {
    console.log(`[weather] 캐시 EMPTY — nx=${nx} ny=${ny} (${base_time})`);
    return [];
  }
  if (cached !== null) {
    console.log(`[weather] 캐시 HIT — nx=${nx} ny=${ny} (${base_time})`);
    return cached;
  }

  try {
    const data = await weatherFetch<WeatherItem>("getUltraSrtNcst", {
      nx,
      ny,
      base_date,
      base_time,
    });
    const items = extractWeatherItems(data);
    if (items.length === 0) {
      await setCachedEmpty(cacheKey, TTL.WEATHER_NCST);
    } else {
      await setCached(cacheKey, items, TTL.WEATHER_NCST);
    }
    console.log(`[weather] nx=${nx} ny=${ny} (${base_time}) → ${items.length}건`);
    return items;
  } catch {
    return [];
  }
}

export async function getUltraSrtFcst(
  nx: number,
  ny: number,
  now: Date = new Date(),
): Promise<WeatherItem[]> {
  const { base_date, base_time } = getSrtFcstBaseTime(now);
  // getUltraSrtNcst와 동일한 격자+발표시각 단위 캐시.
  const cacheKey = `weather:fcst:${nx}:${ny}:${base_date}:${base_time}`;

  const cached = await getCached<WeatherItem[]>(cacheKey);
  if (cached === CACHE_EMPTY) {
    console.log(`[weather] fcst 캐시 EMPTY — nx=${nx} ny=${ny} (${base_time})`);
    return [];
  }
  if (cached !== null) {
    console.log(`[weather] fcst 캐시 HIT — nx=${nx} ny=${ny} (${base_time})`);
    return cached;
  }

  try {
    const data = await weatherFetch<WeatherItem>("getUltraSrtFcst", {
      nx,
      ny,
      base_date,
      base_time,
    });
    const items = extractWeatherItems(data);
    if (items.length === 0) {
      await setCachedEmpty(cacheKey, TTL.WEATHER_FCST);
    } else {
      await setCached(cacheKey, items, TTL.WEATHER_FCST);
    }
    console.log(`[weather] fcst nx=${nx} ny=${ny} (${base_time}) → ${items.length}건`);
    return items;
  } catch {
    return [];
  }
}

// 로드맵 예정 기능용, 현재 미사용
export async function getVilageFcst(
  nx: number,
  ny: number,
  now: Date = new Date(),
): Promise<WeatherItem[]> {
  try {
    const { base_date, base_time } = getVilageFcstBaseTime(now);
    const data = await weatherFetch<WeatherItem>("getVilageFcst", {
      nx,
      ny,
      base_date,
      base_time,
    });
    return extractWeatherItems(data);
  } catch {
    return [];
  }
}

export async function getCurrentWeather(
  lat: number,
  lng: number,
): Promise<Record<string, string>> {
  const { nx, ny } = latlngToGrid(lat, lng);
  const items = await getUltraSrtNcst(nx, ny);
  return Object.fromEntries(
    items.map((item) => [item.category, item.obsrValue ?? ""]),
  );
}

// 현재 실황과 비교해 windowHours 이내에 날씨가 나빠지는(맑음→흐림→비/눈) 첫 시점이
// 있으면 안내 대상으로 반환한다. 변화가 없거나 API 실패 시 null.
export async function getWeatherForecastAlert(
  lat: number,
  lng: number,
  windowHours: number,
  now: Date = new Date(),
): Promise<WeatherForecastAlert | null> {
  const { nx, ny } = latlngToGrid(lat, lng);
  const [currentItems, forecastItems] = await Promise.all([
    getUltraSrtNcst(nx, ny, now),
    getUltraSrtFcst(nx, ny, now),
  ]);

  const currentWeather = Object.fromEntries(
    currentItems.map((item) => [item.category, item.obsrValue ?? ""]),
  );
  const currentCondition = kmaToWeatherCondition(currentWeather);
  const forecast = groupForecastByTime(forecastItems);

  return findUpcomingWeatherChange(forecast, now, currentCondition, windowHours);
}

// 날씨 적응형 추천 전환(lib/pipeline/weatherGate.ts)이 쓰는 "지금~windowHours 이내
// 최악의 날씨" 신호. getUltraSrtNcst/getUltraSrtFcst는 내부에서 이미 에러를 삼키고
// 빈 배열을 반환하므로, API 장애 시 resolveWeatherGateSignal이 자동으로
// condition:"clear"/isHeatwave:false(무감점)로 fail-open된다 — 별도 try/catch 없이도
// availabilityGate.ts의 "판정 불가는 관대 통과" 철학과 동일하게 동작한다.
export async function getWeatherGateSignal(
  lat: number,
  lng: number,
  windowHours: number,
  now: Date = new Date(),
): Promise<WeatherGateSignal> {
  const { nx, ny } = latlngToGrid(lat, lng);
  const [currentItems, forecastItems] = await Promise.all([
    getUltraSrtNcst(nx, ny, now),
    getUltraSrtFcst(nx, ny, now),
  ]);

  const currentWeather = Object.fromEntries(
    currentItems.map((item) => [item.category, item.obsrValue ?? ""]),
  );
  const forecast = groupForecastByTime(forecastItems);

  return resolveWeatherGateSignal(currentWeather, forecast, now, windowHours);
}
