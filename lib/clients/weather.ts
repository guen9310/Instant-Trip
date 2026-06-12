/**
 * 기상청 단기예보 API 클라이언트
 * - 초단기실황 (getUltraSrtNcst): 현재 기온·강수·습도·풍속 등 실시간 관측값
 * - 초단기예보 (getUltraSrtFcst): 6시간 이내 예보 (10분 단위 발표)
 * - 단기예보  (getVilageFcst):    3일 이내 예보 (3시간 단위 발표)
 *
 * 서비스키: 공공데이터포털 → 기상청 단기예보 조회서비스 → 일반 인증키(Decoding) 복사
 * 환경변수: WEATHER_API_KEY
 */

// ─── 상수 ────────────────────────────────────────────────────────────────────

const WEATHER_BASE_URL =
  "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";

// ─── 타입 ────────────────────────────────────────────────────────────────────

/** 기상청 API 공통 응답 래퍼 */
interface KmaApiResponse<T> {
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
}

/** 초단기실황 · 초단기예보 · 단기예보 공통 item */
export interface WeatherItem {
  baseDate: string;   // YYYYMMDD
  baseTime: string;   // HHMM
  category: string;   // 기상 요소 코드 (아래 Category 참고)
  nx: number;         // 예보 격자 X
  ny: number;         // 예보 격자 Y
  obsrValue?: string; // 실황값 (초단기실황 전용)
  fcstDate?: string;  // 예보 일자 (예보 전용)
  fcstTime?: string;  // 예보 시각 (예보 전용)
  fcstValue?: string; // 예보값 (예보 전용)
}

/**
 * 기상 요소 코드 → 한글 설명
 *
 * 초단기실황: T1H, RN1, UUU, VVV, REH, PTY, VEC, WSD
 * 초단기예보: T1H, RN1, SKY, UUU, VVV, REH, PTY, LGT, VEC, WSD
 * 단기예보:   POP, WAV, PTY, PCP, SNO, SKY, TMP, TMN, TMX, UUU, VVV, REH, VEC, WSD
 */
export const CATEGORY_LABEL: Record<string, string> = {
  T1H: "기온(°C)",
  TMP: "기온(°C)",
  TMN: "최저기온(°C)",
  TMX: "최고기온(°C)",
  RN1: "1시간강수량(mm)",
  PCP: "1시간강수량(mm)",
  SNO: "1시간신적설(cm)",
  SKY: "하늘상태",       // 1:맑음 3:구름많음 4:흐림
  PTY: "강수형태",       // 0:없음 1:비 2:비/눈 3:눈 5:빗방울 6:빗방울눈날림 7:눈날림
  LGT: "낙뢰",
  UUU: "동서바람성분(m/s)",
  VVV: "남북바람성분(m/s)",
  VEC: "풍향(deg)",
  WSD: "풍속(m/s)",
  REH: "습도(%)",
  WAV: "파고(m)",
  POP: "강수확률(%)",
};

/** 하늘상태 코드 */
export const SKY_LABEL: Record<string, string> = {
  "1": "맑음",
  "3": "구름많음",
  "4": "흐림",
};

/** 강수형태 코드 */
export const PTY_LABEL: Record<string, string> = {
  "0": "없음",
  "1": "비",
  "2": "비/눈",
  "3": "눈",
  "5": "빗방울",
  "6": "빗방울눈날림",
  "7": "눈날림",
};

/** 위경도 → 기상청 격자 좌표 변환 결과 */
export interface GridXY { nx: number; ny: number }

// ─── 격자 변환 ───────────────────────────────────────────────────────────────

/**
 * 위경도(WGS84) → 기상청 5km 격자(nx, ny) 변환
 * 기상청 공식 알고리즘 그대로 구현
 */
export function latlngToGrid(lat: number, lng: number): GridXY {
  const RE = 6371.00877;   // 지구 반경 (km)
  const GRID = 5.0;        // 격자 간격 (km)
  const SLAT1 = 30.0;      // 표준위도 1
  const SLAT2 = 60.0;      // 표준위도 2
  const OLON = 126.0;      // 기준점 경도
  const OLAT = 38.0;       // 기준점 위도
  const XO = 43;           // 기준점 X좌표
  const YO = 136;          // 기준점 Y좌표

  const DEGRAD = Math.PI / 180;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
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
      const codeMatch = text.match(/<returnReasonCode>(.*?)<\/returnReasonCode>/);
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

// ─── 날짜·시각 헬퍼 ──────────────────────────────────────────────────────────

/** KST(UTC+9) 기준 Date 반환 — getUTC* 메서드로 KST 로컬 값을 읽기 위함 */
function toKst(d: Date): Date {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000);
}

/** KST Date → YYYYMMDD 문자열 */
function kstDateStr(kst: Date): string {
  return kst.toISOString().slice(0, 10).replace(/-/g, "");
}

/** KST Date → HHMM 문자열 */
function kstTimeStr(kst: Date): string {
  return kst.toISOString().slice(11, 13) + kst.toISOString().slice(14, 16);
}

/**
 * 초단기실황 기준시각: 매시 정각(00분) 발표 → 40분 이후부터 유효
 * 40분 미만이면 한 시간 전 데이터 사용
 */
function getNcstBaseTime(now: Date): { base_date: string; base_time: string } {
  const kst = toKst(now);
  if (kst.getUTCMinutes() < 40) kst.setUTCHours(kst.getUTCHours() - 1);
  kst.setUTCMinutes(0, 0, 0);
  return { base_date: kstDateStr(kst), base_time: kstTimeStr(kst) };
}

/**
 * 초단기예보 기준시각: 매시 30분 발표 → 45분 이후부터 유효
 * 45분 미만이면 한 시간 전 데이터 사용
 */
function getSrtFcstBaseTime(now: Date): { base_date: string; base_time: string } {
  const kst = toKst(now);
  if (kst.getUTCMinutes() < 45) kst.setUTCHours(kst.getUTCHours() - 1);
  kst.setUTCMinutes(30, 0, 0);
  return { base_date: kstDateStr(kst), base_time: kstTimeStr(kst) };
}

/**
 * 단기예보 기준시각: 0200·0500·0800·1100·1400·1700·2000·2300 발표
 * 10분 여유 후 유효
 */
function getVilageFcstBaseTime(now: Date): { base_date: string; base_time: string } {
  const ISSUE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23];
  const kst = toKst(now);
  const h = kst.getUTCHours();
  const m = kst.getUTCMinutes();

  let baseHour = ISSUE_HOURS[0];
  for (const ih of ISSUE_HOURS) {
    if (h > ih || (h === ih && m >= 10)) baseHour = ih;
  }
  if (h < 2 || (h === 2 && m < 10)) {
    kst.setUTCDate(kst.getUTCDate() - 1);
    baseHour = 23;
  }

  kst.setUTCHours(baseHour, 0, 0, 0);
  return { base_date: kstDateStr(kst), base_time: kstTimeStr(kst) };
}

// ─── 공개 API ────────────────────────────────────────────────────────────────

/**
 * 초단기실황 조회 — 현재 기온·강수량·습도·풍속 등 실시간 관측값
 * @param nx  기상청 격자 X (latlngToGrid로 변환 가능)
 * @param ny  기상청 격자 Y
 * @param now 기준 시각 (기본값: 현재)
 */
export async function getUltraSrtNcst(
  nx: number,
  ny: number,
  now: Date = new Date(),
): Promise<WeatherItem[]> {
  try {
    const { base_date, base_time } = getNcstBaseTime(now);
    const data = await weatherFetch<WeatherItem>("getUltraSrtNcst", {
      nx, ny, base_date, base_time,
    });
    return extractWeatherItems(data);
  } catch {
    return [];
  }
}

/**
 * 초단기예보 조회 — 향후 6시간 이내 예보
 * @param nx  기상청 격자 X
 * @param ny  기상청 격자 Y
 * @param now 기준 시각 (기본값: 현재)
 */
export async function getUltraSrtFcst(
  nx: number,
  ny: number,
  now: Date = new Date(),
): Promise<WeatherItem[]> {
  try {
    const { base_date, base_time } = getSrtFcstBaseTime(now);
    const data = await weatherFetch<WeatherItem>("getUltraSrtFcst", {
      nx, ny, base_date, base_time,
    });
    return extractWeatherItems(data);
  } catch {
    return [];
  }
}

/**
 * 단기예보 조회 — 향후 3일 이내 예보
 * @param nx  기상청 격자 X
 * @param ny  기상청 격자 Y
 * @param now 기준 시각 (기본값: 현재)
 */
export async function getVilageFcst(
  nx: number,
  ny: number,
  now: Date = new Date(),
): Promise<WeatherItem[]> {
  try {
    const { base_date, base_time } = getVilageFcstBaseTime(now);
    const data = await weatherFetch<WeatherItem>("getVilageFcst", {
      nx, ny, base_date, base_time,
    });
    return extractWeatherItems(data);
  } catch {
    return [];
  }
}

/**
 * 위경도 기반 현재 날씨 요약 조회 (편의 함수)
 * 초단기실황을 카테고리 맵으로 변환해 반환
 *
 * @example
 * const weather = await getCurrentWeather(37.5665, 126.9780); // 서울
 * console.log(weather.T1H); // "23.6" (기온)
 * console.log(weather.PTY); // "0"    (강수형태: 없음)
 */
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
