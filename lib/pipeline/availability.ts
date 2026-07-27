import { tourFetch, extractItems } from "@/lib/tour/client";
import { readCache, writeCache, writeCacheEmpty, CACHE_EMPTY } from "@/lib/tour/cache";
import { ENDPOINTS } from "@/lib/tour/endpoints";
import type {
  TourItem,
  TourDetailIntroAttraction,
  TourDetailIntroCulture,
  TourDetailIntroLeports,
  TourDetailIntroRestaurant,
} from "@/lib/tour/types";
import { TTL } from "@/lib/cache/ttl";
import { getKstHour, getKstMinute, getKstDay } from "@/shared/utils/kst";

export type AvailableItem = TourItem & {
  availabilityUncertain: boolean;
  hours: string | null;
  restDayNote: string | null;
};
const BATCH_SIZE = 20;

type IntroItem =
  | TourDetailIntroAttraction
  | TourDetailIntroCulture
  | TourDetailIntroLeports
  | TourDetailIntroRestaurant;

// contentTypeId별 운영시간·휴무일 필드명 매핑.
// 새로운 콘텐츠 타입 추가 시 이 맵에만 추가하면 된다.
const INTRO_FIELDS: Record<string, { usetime: string; restdate: string }> = {
  "12": { usetime: "usetime", restdate: "restdate" },
  "14": { usetime: "usetimeculture", restdate: "restdateculture" },
  "28": { usetime: "usetimeleports", restdate: "restdateleports" },
};

// <br> 계열 태그를 줄바꿈(\n)으로 보존 치환한다 — 원문의 줄 구분을 그대로 유지해서
// 화면 층이 flex-col 등으로 줄 단위 렌더링을 선택할 수 있게 한다. 각 줄 내부의 연속
// 공백만 하나로 축약하고 trim한다 (줄 자체는 축약하지 않음). 빈 줄은 제거한다.
// usetime/restdate 원문을 화면에 노출하기 전 정리하는 용도 — 판정에 쓰는 원문은 건드리지 않는다.
export function stripBrTags(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

// "09:00~18:00" 또는 "9시~18시" 형식의 운영시간 문자열을 파싱해서
// { open: 분 단위 시작, close: 분 단위 종료 } 형태로 반환한다.
// 파싱에 실패하면 null을 반환한다 (호출부에서 통과 처리).
export function parseTimeRange(
  usetime: string,
): { open: number; close: number } | null {
  const colonMatch = usetime.match(
    /(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})/,
  );
  if (colonMatch) {
    return {
      open: parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]),
      close: parseInt(colonMatch[3]) * 60 + parseInt(colonMatch[4]),
    };
  }
  const hourMatch = usetime.match(/(\d{1,2})시\s*[~\-]\s*(\d{1,2})시/);
  if (hourMatch) {
    return {
      open: parseInt(hourMatch[1]) * 60,
      close: parseInt(hourMatch[2]) * 60,
    };
  }
  return null;
}

// 요일 완전어 패턴 — 단일 문자 매칭 대신 "N요일" 전체를 기준으로 검사해서
// "매일", "공휴일", "매월" 같은 비요일 문맥의 오탐을 방지한다.
const DAY_PATTERNS: RegExp[] = [
  /일요일/,
  /월요일/,
  /화요일/,
  /수요일/,
  /목요일/,
  /금요일/,
  /토요일/,
];

// restdate 문자열에 오늘 요일(완전어)이 포함되어 있으면 휴무로 판단한다.
// 예: "매주 월요일" → 월요일에 true / "매일 운영" → 일요일에도 false
// 한계: "월·화", "격주 월요일", "매월 N번째 요일" 같은 복잡 표기는 탐지 불가 → 통과 처리됨
// dayIndex: 0=일, 1=월, ..., 6=토 (테스트 시 주입 가능)
export function isRestDay(
  restdate: string,
  dayIndex: number = getKstDay(),
): boolean {
  if (!restdate) return false;
  return DAY_PATTERNS[dayIndex].test(restdate);
}

// 요일 인지 판정용 문자 매핑 — getKstDay()/isRestDay와 동일한 0=일...6=토 인덱스.
const DAY_CHAR_TO_INDEX: Record<string, number> = {
  일: 0,
  월: 1,
  화: 2,
  수: 3,
  목: 4,
  금: 5,
  토: 6,
};
// 범위("A~B") 전개 시 순회 순서 — 월요일을 시작으로 한 주 순서(요일 개념의 범위 표기 기준).
const WEEK_ORDER_CHARS = ["월", "화", "수", "목", "금", "토", "일"];

// "A요일~B요일"(또는 축약 "A~B") 범위를 순차 전개한다. 시작이 끝보다 뒤여도 주 경계를
// 넘겨 순회한다 — 예: expandDayRange("토", "화") → [토, 일, 월, 화].
function expandDayRange(startChar: string, endChar: string): number[] {
  const startPos = WEEK_ORDER_CHARS.indexOf(startChar);
  const endPos = WEEK_ORDER_CHARS.indexOf(endChar);
  if (startPos === -1 || endPos === -1) return [];
  const days: number[] = [];
  let pos = startPos;
  for (let i = 0; i < 7; i++) {
    days.push(DAY_CHAR_TO_INDEX[WEEK_ORDER_CHARS[pos]]);
    if (pos === endPos) break;
    pos = (pos + 1) % 7;
  }
  return days;
}

// 요일 chain(예: "월요일~목요일", "월,수,금") 안에서 "구분자? + 문자 + (요일)?" 토큰을
// 순서대로 추출한다. 첫 토큰은 선행 구분자가 없다.
const DAY_TOKEN_WITH_SEP_RE = /([~\-,·/])?\s*([일월화수목금토])(요일)?/g;

// 완전어("월요일")는 단독으로도 인정하지만, 축약형("월")은 범위(~/-)나 나열(,·/)
// 문맥 안에서만 인정한다 — "공휴일"의 "일", "매월"의 "월" 같은 비요일 문맥 오탐을
// 피하기 위함이다(완전 파서가 아니므로 애매하면 정보 없음으로 취급).
const DAY_CHAIN_RE =
  /[일월화수목금토](?:요일)?(?:\s*[~\-,·/]\s*[일월화수목금토](?:요일)?)*/g;

// 한 줄에서 적용 요일 인덱스 집합을 구한다. 요일 정보 자체가 없으면 null(요일 라벨 없음)을 반환한다.
function extractDayIndices(line: string): Set<number> | null {
  let found = false;
  const days = new Set<number>();

  DAY_CHAIN_RE.lastIndex = 0;
  let chainMatch: RegExpExecArray | null;
  while ((chainMatch = DAY_CHAIN_RE.exec(line))) {
    const chain = chainMatch[0];
    const tokens: { sep: string | null; char: string; hasSuffix: boolean }[] =
      [];
    DAY_TOKEN_WITH_SEP_RE.lastIndex = 0;
    let tokenMatch: RegExpExecArray | null;
    while ((tokenMatch = DAY_TOKEN_WITH_SEP_RE.exec(chain))) {
      tokens.push({
        sep: tokenMatch[1] ?? null,
        char: tokenMatch[2],
        hasSuffix: !!tokenMatch[3],
      });
    }
    // 문맥 없는 단독 축약형(길이 1, "요일" 접미사 없음) — 요일 토큰으로 인정하지 않는다.
    if (tokens.length === 1 && !tokens[0].hasSuffix) continue;

    found = true;
    days.add(DAY_CHAR_TO_INDEX[tokens[0].char]);
    for (let i = 1; i < tokens.length; i++) {
      const cur = tokens[i];
      if (cur.sep === "~" || cur.sep === "-") {
        for (const d of expandDayRange(tokens[i - 1].char, cur.char)) {
          days.add(d);
        }
      } else {
        days.add(DAY_CHAR_TO_INDEX[cur.char]);
      }
    }
  }

  return found ? days : null;
}

// 한 줄에서 "HH:MM~HH:MM"(우선) 또는 "H시~H시" 시간대를 전부(global) 추출한다.
// parseTimeRange와 같은 정규식을 재사용하되, 한 요일에 여러 시간대가 있는 경우
// (예: "10:00~11:00, 14:00~15:00")를 모두 뽑아내기 위해 global로 반복 매칭한다.
function extractTimeRanges(line: string): { open: number; close: number }[] {
  const ranges: { open: number; close: number }[] = [];
  const colonRe = /(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = colonRe.exec(line))) {
    ranges.push({
      open: parseInt(m[1]) * 60 + parseInt(m[2]),
      close: parseInt(m[3]) * 60 + parseInt(m[4]),
    });
  }
  if (ranges.length > 0) return ranges;

  const hourRe = /(\d{1,2})시\s*[~\-]\s*(\d{1,2})시/g;
  while ((m = hourRe.exec(line))) {
    ranges.push({ open: parseInt(m[1]) * 60, close: parseInt(m[2]) * 60 });
  }
  return ranges;
}

// 자정을 넘는 운영시간(close < open)을 포함해 현재 시각이 범위 안인지 확인한다.
export function isWithinRange(
  range: { open: number; close: number },
  curMinutes: number,
): boolean {
  return range.close < range.open
    ? curMinutes >= range.open || curMinutes <= range.close
    : curMinutes >= range.open && curMinutes <= range.close;
}

export type KstNow = { day: number; hour: number; minute: number };

type DayAwareResult = {
  verdict: "open" | "closed" | "unknown";
  // 로그 노출용 판정 근거 — 매칭된 요일 줄, 또는 "요일매칭없음"/"요일라벨없음".
  matchReason: string;
};

// [핵심] 운영시간 문자열을 요일 인지 방식으로 판정한다. 완전 파서가 아니다 — 아래
// 명시된 형식(요일 라벨 + 시간대, 또는 요일 라벨 없는 단일/복수 시간대) 외엔 전부 "unknown"이다.
//
// 판단 순서:
// 1. stripBrTags 후 줄 단위로 분리해 각 줄의 요일 라벨을 찾는다(완전어 "월요일", 범위
//    "월요일~목요일"/"월~금", 나열 "월,수,금"만 인정 — 문맥 없는 단독 축약형은 무시).
// 2. 요일 라벨이 하나라도 있는 문서인데 오늘 요일과 매칭되는 줄이 없으면 → closed
//    (예: 금/토 요일 정보만 있고 오늘이 일요일이면, 오늘은 영업 안 하는 것으로 판단).
// 3. 오늘 매칭되는 줄이 있으면, 그 줄(들)의 모든 시간대와 현재 시각을 비교한다.
//    매칭 줄은 있는데 그 안에서 시간대 파싱이 실패하면 → unknown(완전 파서 금지 원칙).
// 4. 요일 라벨이 전혀 없으면 → 기존 방식(문자열 첫 매치 시간대 하나)으로 비교한다.
//    그마저 파싱 실패하면 → unknown.
function evaluateDayAwareHours(usetime: string, now: KstNow): DayAwareResult {
  const lines = stripBrTags(usetime)
    .split("\n")
    .filter((l) => l.length > 0);
  const curMinutes = now.hour * 60 + now.minute;
  const curTimeStr = `${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}`;

  let anyDayLabelFound = false;
  const matchedLines: string[] = [];

  for (const line of lines) {
    const dayIndices = extractDayIndices(line);
    if (dayIndices === null) continue;
    anyDayLabelFound = true;
    if (dayIndices.has(now.day)) matchedLines.push(line);
  }

  if (anyDayLabelFound) {
    if (matchedLines.length === 0) {
      return { verdict: "closed", matchReason: "요일매칭없음" };
    }
    const ranges = matchedLines.flatMap(extractTimeRanges);
    if (ranges.length === 0) {
      return {
        verdict: "unknown",
        matchReason: `요일매칭(${matchedLines.join(" / ")}) 시간대파싱실패`,
      };
    }
    const isOpen = ranges.some((r) => isWithinRange(r, curMinutes));
    return {
      verdict: isOpen ? "open" : "closed",
      matchReason: `요일매칭(${matchedLines.join(" / ")}) / 현재 ${curTimeStr}`,
    };
  }

  // 요일 라벨이 전혀 없는 자유 텍스트 — 기존 첫 매치 시간대 비교로 폴백한다.
  const range = parseTimeRange(usetime);
  if (!range) {
    return { verdict: "unknown", matchReason: "요일라벨없음, 시간대파싱실패" };
  }
  const isOpen = isWithinRange(range, curMinutes);
  return {
    verdict: isOpen ? "open" : "closed",
    matchReason: `요일라벨없음 / 현재 ${curTimeStr}`,
  };
}

// evaluateDayAwareHours의 판정(verdict)만 노출하는 공개 함수 — 단위 테스트가 이 함수로
// 시나리오를 검증한다. 판정 근거 로그가 필요한 내부 호출부(checkAvailability)는
// evaluateDayAwareHours를 직접 호출해 matchReason도 함께 얻는다.
export function checkOpenByDayAwareHours(
  usetime: string,
  now: KstNow,
): "open" | "closed" | "unknown" {
  return evaluateDayAwareHours(usetime, now).verdict;
}

type Verdict =
  | "제외(휴무)"
  | "제외(운영종료)"
  | "통과(영업중)"
  | "통과(데이터없음)"
  | "통과(파싱실패)"
  | "통과(API오류)"
  | "검사안함(source=kakao)";

type OpenResult =
  | { open: true; reason: string; label: Verdict }
  | { open: false; reason: string; label: Verdict };

// 운영시간(usetime)과 휴무일(restdate) 문자열을 받아서 현재 시각에 운영 중인지 판단한다.
//
// 판단 순서:
// 1. 오늘이 휴무일이면 → 닫힘
// 2. 운영시간 데이터가 없으면 → 통과 (데이터 없음 = 판단 불가 → 관대하게 처리)
// 3. "24시간" 또는 "연중무휴" 포함 → 열림
// 4. 요일 인지 판정(evaluateDayAwareHours) → open/closed면 그대로 반영, unknown이면 통과
function checkAvailability(usetime: string, restdate: string): OpenResult {
  const now: KstNow = {
    day: getKstDay(),
    hour: getKstHour(),
    minute: getKstMinute(),
  };

  if (isRestDay(restdate, now.day)) {
    return {
      open: false,
      reason: `휴무일 (${restdate.slice(0, 20)})`,
      label: "제외(휴무)",
    };
  }
  if (!usetime) {
    return {
      open: true,
      reason: "이용시간 데이터 없음 → 통과",
      label: "통과(데이터없음)",
    };
  }
  const lower = usetime.toLowerCase();
  if (lower.includes("24시간") || lower.includes("연중무휴")) {
    return { open: true, reason: "24시간/연중무휴", label: "통과(영업중)" };
  }

  const { verdict, matchReason } = evaluateDayAwareHours(usetime, now);
  if (verdict === "unknown") {
    return {
      open: true,
      reason: `파싱불가 → 통과 (${matchReason}, 원문: "${usetime.slice(0, 30)}")`,
      label: "통과(파싱실패)",
    };
  }
  const isOpen = verdict === "open";
  return {
    open: isOpen,
    reason: matchReason,
    label: isOpen ? "통과(영업중)" : "제외(운영종료)",
  };
}

// 단일 장소 가용성 검사 결과 — 차단 여부(open)와 함께 판정 근거를 그대로 노출한다.
// filterByAvailability(배치)와 장소 선택 진입(단일, 비차단) 양쪽이 공유하는 형태.
export type PlaceAvailabilityCheck = {
  open: boolean;
  // 판정 자체가 불확실한 경우(API 오류·intro 없음·파싱 실패) true.
  // open=true는 이 경우 "차단하지 않기 위한 관대 처리"일 뿐 실제 영업 확인이 아니다.
  uncertain: boolean;
  label: Verdict;
  hours: string | null; // usetime 원문 (없으면 null)
  restDayNote: string | null; // restdate 원문 (없으면 null)
};

// [stage2 코어] 장소 1건의 운영시간(usetime)·휴무일(restdate)을 detailIntro2로 조회해
// 현재 시각 기준 운영 여부를 판정한다. filterByAvailability의 배치 루프와 장소 선택
// 진입(선택 코스 생성)의 단일 호출이 이 함수 하나를 공유한다 — 캐시·판정 로직 이중화 방지.
//
// API 실패·intro 없음·파싱 실패는 uncertain=true로 표시하고 open=true(관대 통과)를 반환한다.
// 호출부가 이 결과로 "차단"할지 "데이터로만 노출"할지 결정한다.
export async function checkPlaceAvailability(
  item: TourItem,
  logPrefix: string,
): Promise<PlaceAvailabilityCheck> {
  const cacheKey = `tour:detailIntro2:${item.contentid}`;
  const cachedIntro = await readCache<IntroItem>(cacheKey);

  // 이전 API 호출에서 데이터가 없었던 장소 — 재호출 없이 통과(uncertain)
  if (cachedIntro === CACHE_EMPTY) {
    console.log(`${logPrefix} → 캐시 HIT (빈 응답) → uncertain=true`);
    return {
      open: true,
      uncertain: true,
      label: "통과(데이터없음)",
      hours: null,
      restDayNote: null,
    };
  }

  const ts = Date.now();
  let intro: IntroItem | undefined;

  if (cachedIntro !== null) {
    intro = cachedIntro;
    console.log(`${logPrefix} → 캐시 HIT`);
  } else {
    console.log(`${logPrefix} → detailIntro2 API 호출`);
    try {
      const data = await tourFetch<IntroItem>(ENDPOINTS.DETAIL_INTRO, {
        contentId: item.contentid,
        contentTypeId: item.contenttypeid,
      });
      intro = extractItems(data)[0];
      if (intro) {
        await writeCache(cacheKey, intro, TTL.DETAIL_INTRO);
      } else {
        await writeCacheEmpty(cacheKey, TTL.EMPTY_RESULT);
      }
    } catch (err) {
      console.warn(`${logPrefix} → 통과(API오류) → uncertain=true (${Date.now() - ts}ms) — ${err}`);
      // 운영시간을 확인하지 못한 채 통과시키는 것이므로 불확실 플래그를 켠다.
      return {
        open: true,
        uncertain: true,
        label: "통과(API오류)",
        hours: null,
        restDayNote: null,
      };
    }
  }

  const elapsed = Date.now() - ts;

  // intro 자체가 없는 경우 (API는 성공했지만 해당 장소의 상세 정보가 DB에 없는 경우).
  // 데이터 미비로 인한 것이므로 통과시킨다.
  if (!intro) {
    console.log(
      `${logPrefix} → 통과(데이터없음) intro 자체 없음 → uncertain=true (${elapsed}ms)`,
    );
    return {
      open: true,
      uncertain: true,
      label: "통과(데이터없음)",
      hours: null,
      restDayNote: null,
    };
  }

  // contentTypeId별 필드명을 INTRO_FIELDS 맵으로 조회해서 운영시간·휴무일을 추출한다.
  // 알 수 없는 타입은 빈 문자열로 처리(통과).
  const fields = INTRO_FIELDS[item.contenttypeid] ?? {
    usetime: "",
    restdate: "",
  };
  const raw = intro as unknown as Record<string, string>;
  const usetime = raw[fields.usetime] ?? "";
  const restdate = raw[fields.restdate] ?? "";

  const restdayResult = isRestDay(restdate);
  const result = checkAvailability(usetime, restdate);
  const uncertain =
    result.label === "통과(데이터없음)" || result.label === "통과(파싱실패)";

  // 필드명과 원문값, isRestDay 입력·결과를 한 줄로 출력한다.
  const fieldLog = fields.restdate
    ? `${fields.restdate}="${restdate}" ${fields.usetime}="${usetime.slice(0, 40)}"`
    : `(알수없는타입=${item.contenttypeid})`;
  const restdayLog = `isRestDay("${restdate.slice(0, 20)}")=${restdayResult}`;
  console.log(
    `${logPrefix} | ${fieldLog}\n         → ${restdayLog} → ${result.label} ${result.reason} → open=${result.open} uncertain=${uncertain} (${elapsed}ms)`,
  );

  return {
    open: result.open,
    uncertain,
    label: result.label,
    hours: usetime ? stripBrTags(usetime) : null,
    restDayNote: restdate ? stripBrTags(restdate) : null,
  };
}

// [레거시/진단용] stage1에서 수집한 장소 전부에 대해 운영 중인 곳만 배치로 걸러낸다.
//
// 프로덕션 `generateCourse`(lib/pipeline/index.ts)는 더 이상 이 함수를 호출하지 않는다 —
// 점수화(stage4)가 운영시간 데이터를 전혀 쓰지 않는다는 게 확인되어, "전수 배치 검사 후
// 점수화" 대신 "점수화 후 순위 순으로 하나씩만 검사"하는 `availabilityGate.ts`의
// `selectAvailableCandidate`로 대체됐다(TourAPI 일일 호출 한도 절감 목적). 이 함수는
// `tests/unit/pipeline-diagnostic.test.ts`(CI 제외, 수동 진단용) 전용으로 남겨둔다.
//
// - detailIntro2 API로 각 장소의 운영시간(usetime)과 휴무일(restdate)을 조회한다.
// - BATCH_SIZE개씩 배치로 묶어 Promise.all로 병렬 처리한다.
//   (배치 경계 없는 동시성 워커 풀도 시도했으나, TourAPI에 지속적으로 최대 동시
//   요청을 유지하자 타임아웃이 118건 중 50건까지 폭증했다 — 배치의 "가장 느린
//   항목을 기다리는" 비효율이 의도치 않게 TourAPI에 숨 고를 틈을 주고 있었다.
//   배치 방식이 이론상 덜 효율적이지만 이 API엔 이쪽이 실측상 더 안정적이다.)
// - 행사(contenttypeid=15)는 운영시간 개념이 없으므로 이 단계를 건너뛰고 stage3에서 처리한다.
// - API 실패 시에도 해당 장소를 통과시킨다 (코스 생성이 멈추는 것보다 낫다).
// - 반환값: 운영 중으로 판단된 AvailableItem 배열 (availabilityUncertain 플래그 포함)
export async function filterByAvailability(
  items: TourItem[],
): Promise<AvailableItem[]> {
  const available: AvailableItem[] = [];
  const t0 = Date.now();
  let passed = 0,
    blocked = 0,
    // eslint-disable-next-line prefer-const
    skipped = 0,
    errCount = 0;

  console.log(
    `[stage2] ${items.length}건 가용성 검사 시작 (배치 ${BATCH_SIZE})`,
  );

  const checkItem = async (
    item: TourItem,
    globalIdx: number,
  ): Promise<AvailableItem | null> => {
    const idx = `[${globalIdx + 1}/${items.length}]`;
    const prefix = `[stage2] ${idx} "${item.title}" type=${item.contenttypeid} src=${item.source ?? "tour"}`;

    const result = await checkPlaceAvailability(item, prefix);
    if (result.label === "통과(API오류)") errCount++;

    if (result.open) {
      passed++;
      return {
        ...item,
        availabilityUncertain: result.uncertain,
        hours: result.hours,
        restDayNote: result.restDayNote,
      };
    }
    blocked++;
    return null;
  };

  // BATCH_SIZE개씩 끊어서 병렬 처리한다.
  // 한꺼번에 전부 병렬 처리하면 API 레이트 리밋에 걸릴 수 있어서 배치로 나눈다.
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((item, j) => checkItem(item, i + j)),
    );
    for (const result of results) {
      if (result !== null) available.push(result);
    }
  }

  console.log(
    `[stage2] 완료 — 통과 ${passed} / 제외 ${blocked} / 행사위임 ${skipped} / 오류통과 ${errCount}` +
      ` → ${available.length}건 (총 ${Date.now() - t0}ms)`,
  );
  return available;
}
