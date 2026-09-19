/**
 * lib/tour/hours.ts
 *
 * TourAPI detailIntro2의 usetime(이용시간)/restdate(휴무일) 원문을
 * 요일·월·공휴일 인지 방식으로 해석해 "지금 갈 수 있는지"를 판정한다.
 *
 * 판정 원칙 (2026-09 개정, 실측 원문 84건 — tests/fixtures/tourapi-hours-sample-2026-09.json):
 *  1. 알아본 조각을 원문에서 지우고 남은 글자 중 방문 가능 여부를 바꾸는 조건(예약제·내부 인원만·
 *     전시/공연 기간·공연별 상이·해석 못 한 예외 조항 등, VISIT_CONDITION_RE)이 있을 때만 "영업 중"을
 *     단정하지 않는다(uncertain). 남은 글자를 전부 조건으로 보면 추천의 절반 가까이에 "운영시간 확인
 *     필요"가 붙어(2026-09-16 추천 결과 비교, 144회 중 68회) "결정을 줄인다"는 흐름과 충돌해 좁혔다.
 *     그 밖의 안내문("주일단위 전시", 시설 이름 나열)은 판정에 영향을 주지 않는다고 본다.
 *     휴무 근거(휴무 요일·공휴일·명절·지정일)가 확실하면 남은 조건이 있어도 휴무를 유지한다 —
 *     여기서의 오판은 헛걸음(닫힌 곳 추천)보다 놓침(열린 곳 제외)이 덜 해롭기 때문이다.
 *  2. 휴무 요일은 목록 끝까지 읽는다 — "매주 일요일 / 월요일", "매주 토요일~일요일", "주말".
 *  3. 요일은 요일로 쓰인 자리에서만 읽는다 — "공휴일"의 "일", "10월"의 "월"은 요일이 아니다.
 *  4. 공휴일·설·추석·지정일 휴무와 "공휴일인 경우 다음날 휴관" 같은 예외 조항은 정적 공휴일 표
 *     (shared/constants/holidays.ts)로 대조한다. 표에 없는 연도면 영업을 단정하지 않는다.
 *  5. 월·계절 구간([3월~4월], 하절기(3~10월))과 제목 줄([평일], [토요일])은 아래 시간 줄에 적용한다.
 *  6. 휴게·준비시간은 운영시간에서 뺀다. 문 열기 전·휴게 중은 운영 종료와 구분해
 *     before_open으로 돌려준다 — 곧 열 곳을 후보로 남길지는 호출부(availabilityGate)가 정한다.
 *
 * 타임존 안전성: "지금" 판정은 서버 런타임 타임존과 무관하게 항상 KST(Asia/Seoul)
 * 기준이어야 한다 — shared/utils/kst.ts(Intl 기반, Asia/Seoul 명시)를 쓰고, 시각 변환은
 * atTime()에서 +09:00 오프셋을 명시한다.
 */

import { getKstDay, getKstDateString } from "@/shared/utils/kst";
import { getHolidayInfo } from "@/shared/utils/holidays";
import type { AvailabilityStatus } from "@/shared/types/availability.types";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = 일요일 (Date.getDay() 기준과 동일)

export interface AvailabilityResult {
  status: AvailabilityStatus;
  /** UI 배지/로그용 사람이 읽을 수 있는 사유 */
  reason: string;
  closesAt?: Date;
  admissionCutoffAt?: Date;
  /** status === 'open' 이면 true, 그 외 false 또는 undefined(체류시간 미검사) */
  canCompleteVisit?: boolean;
  /** status === 'before_open'일 때 다음으로 문을 여는(휴게 후 재개 포함) 시각 */
  opensAt?: Date;
  /** status === 'before_open'일 때 opensAt까지 남은 분 */
  minutesUntilOpen?: number;
  /** 해석하지 못하고 남은 조각 — 판정 로그에 남겨 자주 나오는 표현부터 규칙을 늘린다 */
  unreadFragments?: string[];
}

const DAY_CHAR_TO_WEEKDAY: Record<string, Weekday> = {
  일: 0,
  월: 1,
  화: 2,
  수: 3,
  목: 4,
  금: 5,
  토: 6,
};

// "월~금" 같은 범위 표기를 펼칠 때 순회 방향 기준 (한국식 요일 순서)
const WEEK_DISPLAY_ORDER = ["월", "화", "수", "목", "금", "토", "일"];
const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];
const WEEKEND: Weekday[] = [0, 6];

// ─── 조각 소비 도구 ─────────────────────────────────────────────────────────────

// 정규식에 걸린 조각을 원문에서 지우고(같은 길이의 공백으로 치환) onMatch로 넘긴다. accept가 false를
// 돌려준 매치는 지우지 않는다 — 그 조각은 "못 읽은 조건"으로 남는다.
function take(
  text: string,
  re: RegExp,
  onMatch?: (m: RegExpMatchArray) => void,
  accept: (m: RegExpMatchArray) => boolean = () => true,
): string {
  return text.replace(re, (...args) => {
    // replace 콜백 인자: (match, ...groups, offset, string) — matchAll과 같은 모양으로 맞춘다.
    const groups = args.slice(0, -2) as string[];
    const m = Object.assign([...groups], { index: args[args.length - 2] as number }) as unknown as RegExpMatchArray;
    if (!accept(m)) return m[0];
    onMatch?.(m);
    // 같은 길이의 공백으로 바꿔 위치(index)를 보존한다 — 한 줄 안에서 요일 표기와 시간 표기의
    // 앞뒤 순서를 비교할 때 서로 다른 단계의 index를 그대로 비교할 수 있어야 한다.
    return " ".repeat(m[0].length);
  });
}

// 판정에 영향을 주지 않는 안내문 — 다른 조각이 읽혔다면 지워도 되는 문구. 이 목록에 없는
// 문구는 모두 "못 읽은 조건"으로 남는다. 목록은 실측 원문에서 반복된 표현만 넣는다.
const HARMLESS_NOTES: RegExp[] = [
  /(?:자세한\s*(?:사항|내용)은?\s*)?(?:방문\s*전\s*)?(?:전화|유선)\s*문의\s*(?:요망|필수|바람|바랍니다)?/g,
  /(?:자세한\s*(?:사항|내용)은?\s*)?홈페이지\s*(?:참조|참고|확인)\s*(?:요망|바람|바랍니다)?/g,
  /(?:별도\s*)?문의\s*(?:요망|바람|바랍니다)/g,
  // 임시 휴관은 어느 장소에나 생길 수 있어 원문에 적혀 있다고 판정이 달라지지 않는다.
  /(?:(?:기관|도서관|시설|내부|자체)\s*)?사정에\s*(?:의한|따른|따라)\s*임시\s*(?:휴관|휴무)(?:일)?/g,
  /임시\s*(?:휴관|휴무)(?:일)?/g,
  /24\s*시간?\s*개방/g,
];

const PUNCTUATION = /[\s\-–~·,/()[\]※:：.!]+/g;
const HAS_WORD = /[가-힣A-Za-z0-9]/;

function removeHarmless(text: string): string {
  return HARMLESS_NOTES.reduce((acc, re) => take(acc, re), text);
}

// 중립 단어·문장부호를 걷어내고 남은 글자. 비어 있으면 모든 조각을 읽은 것이다.
function unreadText(text: string, neutral: RegExp): string {
  const rest = text.replace(neutral, " ").replace(PUNCTUATION, " ").replace(/\s+/g, " ").trim();
  return HAS_WORD.test(rest) ? rest : "";
}

// 남은 글자 중 방문 가능 여부를 바꾸는 조건. 이 표현이 있을 때만 영업 중을 단정하지 않는다.
// 2026-09 실측(원문 84건 + 추천 144회)에서 나온 표현만 넣는다 — 새 표현은 판정 로그의
// "미해석 조각"을 보고 추가한다.
const VISIT_CONDITION_RE =
  /미해석|예약|내부\s*인원|관계자|회원\s*(?:만|전용)|기간|별로|따라|상이|변동|동절기|하절기|계절|경우|(?<![가-힣])단(?![가-힣])|제외|불가|휴무|휴관|휴장|폐쇄|통제|중단/;

function visitCondition(text: string, neutral: RegExp): string {
  const leftover = unreadText(text, neutral);
  return VISIT_CONDITION_RE.test(leftover) ? leftover : "";
}

// ─── 시각 ──────────────────────────────────────────────────────────────────────

const TIME = String.raw`([0-2]?\d)\s*(?::|시)\s*(\d{2})?\s*분?`;
const TIME_RANGE_RE = new RegExp(String.raw`${TIME}\s*[~\-–]\s*${TIME}`, "g");
const BREAK_RE = new RegExp(
  String.raw`(?:휴게|준비|브레이크|점심)\s*(?:시간|타임)?\s*[:：]?\s*${TIME}\s*[~\-–]\s*${TIME}`,
  "g",
);
// 뒤에 "~"가 오는 시각은 입장 마감이 아니라 운영시간 범위의 시작이다(숫자 되짚기 방지 포함).
const ABS_CUTOFF_RE = new RegExp(
  String.raw`(?:입장|입산|매표|발권)\s*(?:마감|가능|시간)?\s*[:：(]?\s*${TIME}(?![\d]|\s*[~\-–])\s*(?:까지)?\s*(?:가능)?`,
  "g",
);
const REL_CUTOFF_RE =
  /(?:(?:이용|운영|관람)\s*(?:시간)?\s*)?(?:마감|종료|폐관)?\s*(\d+)\s*(시간|분)\s*전(?:까지)?\s*(?:입장|매표|발권)?\s*(?:마감|가능)?/g;
// "상시 운영"은 넣지 않는다 — 축제 playtime 등에서 "기간 중 운영"의 뜻으로도 쓰여 새벽까지
// 열려 있다는 근거가 되지 않는다.
const ALWAYS_OPEN_RE =
  /상시\s*(?:개방|출입\s*가능|이용\s*가능|관람\s*가능|이용)|24\s*시간\s*(?:개방|이용)/g;
const MONTH_EXTENSION_RE =
  /(?:하절기|동절기)?\s*[([]?\s*(\d{1,2})\s*월?\s*[~\-–]\s*(\d{1,2})\s*월\s*[)\]]?\s*(\d+)\s*시간\s*연장/g;
const MONTH_RANGE_RE = /(?:하절기|동절기)?\s*[([]?\s*(\d{1,2})\s*월?\s*[~\-–]\s*(\d{1,2})\s*월\s*[)\]]?/g;

function toHHMM(h: string, m?: string): string {
  const hour = Math.min(Number(h), 24);
  const minute = Math.min(Number(m ?? "0"), 59);
  if (hour === 24) return "23:59";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(total, 23 * 60 + 59));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

// hh:mm을 base가 속한 KST 캘린더 날짜의 그 시각(KST)으로 변환한 절대 시각(Date)을 만든다.
function atTime(base: Date, hhmm: string): Date {
  return new Date(`${getKstDateString(base)}T${hhmm}:00+09:00`);
}

// ─── 요일 ──────────────────────────────────────────────────────────────────────

type DayKey = Weekday | "holiday";

function expandDayRange(start: string, end: string): Weekday[] {
  const startIdx = WEEK_DISPLAY_ORDER.indexOf(start);
  const endIdx = WEEK_DISPLAY_ORDER.indexOf(end);
  const days: Weekday[] = [];
  let i = startIdx;
  for (let step = 0; step < 7; step++) {
    days.push(DAY_CHAR_TO_WEEKDAY[WEEK_DISPLAY_ORDER[i]]);
    if (i === endIdx) break;
    i = (i + 1) % 7;
  }
  return days;
}

function charsToDays(chars: string): Weekday[] {
  return [...chars].filter((c) => c in DAY_CHAR_TO_WEEKDAY).map((c) => DAY_CHAR_TO_WEEKDAY[c]);
}

// 요일로 쓰인 자리만 읽는다. 앞뒤가 한글이면(예: "공휴일"의 "일", "매일"의 "일") 요일이 아니다.
const DAY_RANGE_RE =
  /(?<![가-힣])([월화수목금토일])(?:요일)?\s*[~\-–]\s*([월화수목금토일])(?:요일)?(?![가-힣])/g;
const DAY_LIST_RE = /(?<![가-힣])((?:[월화수목금토일]\s*[·,]\s*)*[월화수목금토일])요일/g;
// "토일 09:00", "토,일 09:00"처럼 시각 바로 앞에 요일 글자만 적힌 경우.
const BARE_DAYS_BEFORE_TIME_RE =
  /(?<![가-힣0-9])((?:[월화수목금토일]\s*[·,]?\s*)*[월화수목금토일])(?=\s*[0-2]?\d\s*(?::|시))/g;
const DAY_KEYWORD_RE = /매일|평일|주중|주말|(?:법정\s*)?공휴일/g;
// "매월 첫째 주 월요일", "격주 화요일"은 매주 반복이 아니다 — 요일로 읽지 않고 못 읽은 조건으로 남긴다.
const NON_WEEKLY_RE =
  /(?:매월\s*)?(?:(?:첫|둘|셋|넷|다섯)\s*째|마지막(?=\s*(?:주|[월화수목금토일]요일|평일|주말)))(?:\s*주)?(?:\s*(?:,|·|및)?\s*(?:(?:첫|둘|셋|넷|다섯)\s*째|마지막)(?:\s*주)?)*\s*(?:[월화수목금토일]요일)?|격주\s*(?:[월화수목금토일]요일)?/g;
const UNREAD_MARK = " 미해석 ";

// 한 줄에서 요일 표기를 모두 읽어 지운다. 읽은 요일, 매주가 아닌 요일(매월 N째·격주), 첫 요일
// 표기의 위치를 돌려준다. 요일 없이 쓰인 불규칙 표기("매월 말 마지막 평일")는 못 읽은 조건으로 남긴다.
function takeDays(line: string): {
  rest: string;
  days: Set<DayKey>;
  irregularDays: Set<Weekday>;
  firstIndex: number;
} {
  const days = new Set<DayKey>();
  const irregularDays = new Set<Weekday>();
  let firstIndex = Infinity;
  const note = (m: RegExpMatchArray) => {
    firstIndex = Math.min(firstIndex, m.index ?? Infinity);
  };
  let rest = line.replace(/매주/g, " 매주 ");
  rest = rest.replace(NON_WEEKLY_RE, (m) => {
    if (!m.trim()) return m;
    const weekday = m.match(/([월화수목금토일])요일/);
    if (!weekday) return UNREAD_MARK;
    irregularDays.add(DAY_CHAR_TO_WEEKDAY[weekday[1]]);
    return " ".repeat(m.length);
  });
  rest = take(rest, DAY_RANGE_RE, (m) => {
    note(m);
    expandDayRange(m[1], m[2]).forEach((d) => days.add(d));
  });
  rest = take(rest, DAY_LIST_RE, (m) => {
    note(m);
    charsToDays(m[1]).forEach((d) => days.add(d));
  });
  rest = take(rest, BARE_DAYS_BEFORE_TIME_RE, (m) => {
    note(m);
    charsToDays(m[1]).forEach((d) => days.add(d));
  });
  rest = take(rest, DAY_KEYWORD_RE, (m) => {
    note(m);
    const kw = m[0].replace(/\s/g, "");
    if (kw === "매일") ALL_DAYS.forEach((d) => days.add(d));
    else if (kw === "평일" || kw === "주중") WEEKDAYS.forEach((d) => days.add(d));
    else if (kw === "주말") WEEKEND.forEach((d) => days.add(d));
    else days.add("holiday");
  });
  return { rest, days, irregularDays, firstIndex };
}

// ─── usetime ───────────────────────────────────────────────────────────────────

interface TimeRange {
  open: string; // "HH:MM"
  close: string;
}

export interface HoursRule {
  /** 이 규칙이 적용되는 요일. null이면 요일 구분 없음. "holiday"는 공휴일. */
  days: Set<DayKey> | null;
  /** [시작월, 끝월] (끝이 작으면 해를 넘기는 구간). null이면 연중. */
  months: [number, number] | null;
  ranges: TimeRange[];
  breaks: TimeRange[];
  admissionCutoff?: string;
  cutoffMinutesBeforeClose?: number;
}

export interface ParsedUseTime {
  rules: HoursRule[];
  /** "하절기(5~9월) 1시간연장" 같은 월별 마감 연장 */
  extensions: { months: [number, number]; minutes: number }[];
  /** 원문 어딘가에 한 번만 적힌 상대 입장 마감("이용시간 1시간 전 입장마감") — 모든 규칙 공통 */
  globalCutoffMinutes: number | null;
  /** 못 읽은 조건이 남았는지 */
  unread: boolean;
  unreadFragments: string[];
}

const USETIME_NEUTRAL = /이용|운영|관람|개방|개관|매표|입장|시간|가능|까지/g;

/**
 * usetime 원문을 규칙 목록으로 해석한다.
 * null/빈 문자열이면 null — 호출부는 no_data로 분기한다.
 */
export function parseUseTime(usetimeRaw: string | null | undefined): ParsedUseTime | null {
  if (!usetimeRaw || !usetimeRaw.trim()) return null;

  const result: ParsedUseTime = {
    rules: [],
    extensions: [],
    globalCutoffMinutes: null,
    unread: false,
    unreadFragments: [],
  };

  // 줄 구분: 줄바꿈, "/", 그리고 시각 뒤에 오는 콤마 중 뒤에 요일이 이어지는 것.
  // ("토,일 09:00"의 요일 콤마와 "09:00~12:00, 13:00~18:00"의 시간 콤마는 나누지 않는다.)
  // "/"로 나뉜 조각은 같은 원문 줄 안의 나열이라("- 일요일 / 공휴일 09:00~18:00") 시간 없는
  // 앞 조각의 요일을 다음 조각의 요일에 합친다. 줄바꿈을 넘어서는 합치지 않는다.
  const lines = usetimeRaw.split("\n").flatMap((physical) =>
    physical
      .split(/\/|(?<=\d)\s*,\s*(?=[월화수목금토일]|주중|주말|평일)/)
      .map((s, i) => ({ text: s.trim(), continuesLine: i > 0 }))
      .filter((l) => l.text),
  );

  let monthContext: [number, number] | null = null;
  let dayContext: Set<DayKey> | null = null;
  let slashDays: Set<DayKey> | null = null;

  for (const { text: rawLine, continuesLine } of lines) {
    if (!continuesLine) slashDays = null;
    let line = removeHarmless(rawLine);
    // 괄호 속 휴무 안내("(공휴일 휴무)")는 usetime에서 해석하지 않는다 — 휴무일은 restdate가
    // 담당하고, 여기서 요일로 읽으면 휴무 요일에 운영시간을 붙이게 된다.
    line = line.replace(/[([][^()[\]]*(?:휴무|휴관|휴장)[^()[\]]*[)\]]/g, UNREAD_MARK);

    line = take(line, MONTH_EXTENSION_RE, (m) => {
      result.extensions.push({ months: [Number(m[1]), Number(m[2])], minutes: Number(m[3]) * 60 });
    });

    const breaks: TimeRange[] = [];
    line = take(line, BREAK_RE, (m) => {
      breaks.push({ open: toHHMM(m[1], m[2]), close: toHHMM(m[3], m[4]) });
    });

    let admissionCutoff: string | undefined;
    line = take(line, ABS_CUTOFF_RE, (m) => {
      admissionCutoff = toHHMM(m[1], m[2]);
    });

    let relCutoff: number | undefined;
    line = take(
      line,
      REL_CUTOFF_RE,
      (m) => {
        relCutoff = Number(m[1]) * (m[2] === "시간" ? 60 : 1);
      },
      // "예약은 2시간 전까지"처럼 입장과 무관한 "N시간 전"은 읽지 않는다.
      (m) => /입장|매표|발권|마감/.test(m[0]),
    );
    if (relCutoff != null && result.globalCutoffMinutes == null) result.globalCutoffMinutes = relCutoff;

    let lineMonths: [number, number] | null = null;
    line = take(line, MONTH_RANGE_RE, (m) => {
      lineMonths = [Number(m[1]), Number(m[2])];
    });

    const alwaysOpen = ALWAYS_OPEN_RE.test(line);
    ALWAYS_OPEN_RE.lastIndex = 0;
    line = take(line, ALWAYS_OPEN_RE);

    const { rest: afterDays, days, irregularDays: lineIrregular, firstIndex: firstDayIndex } = takeDays(line);
    line = afterDays;
    // 운영시간 쪽의 "격주 토요일 운영" 같은 표기는 날짜별로 확정할 수 없다.
    if (lineIrregular.size > 0) line += UNREAD_MARK;

    const ranges: TimeRange[] = [];
    let firstRangeIndex = Infinity;
    line = take(line, TIME_RANGE_RE, (m) => {
      firstRangeIndex = Math.min(firstRangeIndex, m.index ?? Infinity);
      const open = toHHMM(m[1], m[2]);
      let close = toHHMM(m[3], m[4]);
      // 자정을 넘기는 운영(18:00~02:00)은 오늘 날짜 안에서만 본다.
      if (toMinutes(close) <= toMinutes(open)) close = "23:59";
      ranges.push({ open, close });
    });
    if (alwaysOpen) ranges.push({ open: "00:00", close: "23:59" });

    const condition = visitCondition(line, USETIME_NEUTRAL);
    if (condition) {
      result.unread = true;
      result.unreadFragments.push(condition);
    }

    const hasDays = days.size > 0;
    if (ranges.length === 0) {
      // 시간 없는 줄은 아래 시간 줄에 적용되는 제목 줄이다([3월~4월], [평일]).
      if (lineMonths) {
        monthContext = lineMonths;
        dayContext = null;
      }
      if (hasDays) {
        dayContext = days;
        slashDays = days;
      }
      continue;
    }

    // 한 줄에 시간이 여러 개인데 요일 표기가 첫 시간 뒤에 나오면("10:00~22:00 (일요일 10:00~18:00)")
    // 어느 시간이 어느 요일 것인지 확정할 수 없다 — 요일 구분 없이 합치고 못 읽은 조건으로 둔다.
    let ruleDays: Set<DayKey> | null = hasDays
      ? new Set<DayKey>([...days, ...(continuesLine && slashDays ? slashDays : [])])
      : dayContext;
    slashDays = null;
    if (hasDays && ranges.length > 1 && firstDayIndex > firstRangeIndex) {
      ruleDays = null;
      result.unread = true;
    }

    result.rules.push({
      days: ruleDays,
      months: lineMonths ?? monthContext,
      ranges,
      breaks,
      admissionCutoff,
      cutoffMinutesBeforeClose: relCutoff,
    });
  }

  return result;
}

// ─── restdate ──────────────────────────────────────────────────────────────────

export interface ParsedRestDate {
  weekdays: Set<Weekday>;
  /** 공휴일(대체공휴일 포함) 휴무 */
  onHolidays: boolean;
  /** 모든 공휴일의 다음 날 휴무("공휴일 다음날") */
  dayAfterHoliday: boolean;
  /** 정기 휴무 요일이 공휴일일 때의 예외 — open: 정상 운영, nextDay: 정상 운영 후 다음 날 휴무 */
  holidayException: "open" | "nextDay" | null;
  seollal: "day" | "period" | null;
  chuseok: "day" | "period" | null;
  fixedDates: { month: number; day: number }[];
  /** "매월 둘째 주 월요일"처럼 매주가 아닌 휴무 요일 — 그 요일에만 영업을 단정하지 않는다 */
  irregularWeekdays: Set<Weekday>;
  noClosure: boolean;
  unread: boolean;
  unreadFragments: string[];
}

const REST_NEXT_DAY_EXCEPTION_RE =
  /[([]?\s*(?:단\s*[,.]?\s*)?(?:[월화수목금토일]요일이\s*)?(?:법정\s*)?공휴일(?:인|일)\s*경우\s*(?:정상\s*(?:개관|운영|개방)\s*(?:후|하고)?\s*[,.]?\s*)?(?:그\s*)?(?:다음\s*날|익일)(?:\s*[월화수목금토일]요일)?\s*(?:휴관|휴무)?\s*[)\]]?/g;
const REST_OPEN_EXCEPTION_RE =
  /[([]?\s*(?:단\s*[,.]?\s*)?(?:법정\s*)?공휴일(?:\s*및\s*대체\s*공휴일)?(?:인\s*경우|의\s*경우|은|는)?\s*(?:정상\s*(?:운영|개관|개방)|제외)\s*[)\]]?/g;
// 궁궐·능원 공통 문구 — "정기휴일이 공휴일과 겹치면 개방하고 그다음 첫 번째 비공휴일이 정기휴일".
// 연휴가 이어지면 휴무가 더 뒤로 밀리지만, 공휴일 다음 날로 근사한다(대부분 하루짜리 공휴일).
const REST_PALACE_EXCEPTION_RE =
  /(?:※\s*)?(?:단\s*[,.]?\s*)?정기\s*휴(?:일|무일|관일)이\s*(?:법정\s*)?공휴일(?:\s*및\s*대체\s*공휴일)?(?:과|와)\s*겹칠\s*경우(?:에는|에)?\s*개방(?:하며|하고)?\s*[,.]?\s*그\s*다음(?:의)?\s*첫\s*(?:번째)?\s*비\s*공휴일이\s*정기\s*휴(?:일|무일|관일)(?:임|입니다)?/g;
const REST_DAY_AFTER_HOLIDAY_RE = /(?:법정\s*)?공휴일\s*(?:의\s*)?(?:다음\s*날|익일)/g;
const REST_FESTIVAL_RE =
  /(?<![가-힣])(설날|설|구정|추석|명절)(?:\s*[·,/및]\s*(설날|설|구정|추석))?\s*(당일|연휴(?:\s*기간)?|전날|전후)?(?![가-힣])/g;
const REST_FIXED_DATE_RE = /(?:[가-힣]*기념일\s*)?[([]?\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*[)\]]?/g;
const REST_HOLIDAY_RE = /(?:법정\s*)?공휴일|대체\s*(?:공휴일|휴무일|휴일)|국경일|연휴(?:\s*기간)?/g;
const REST_NO_CLOSURE_RE = /연중\s*무휴|(?:휴무|휴관|휴일)\s*없음|무휴/g;
const REST_NEUTRAL = /정기|휴무일|휴관일|휴무|휴관|휴일|휴장|매주|및|쉼|폐관/g;

export function parseRestDate(restdateRaw: string | null | undefined): ParsedRestDate {
  const parsed: ParsedRestDate = {
    weekdays: new Set(),
    onHolidays: false,
    dayAfterHoliday: false,
    holidayException: null,
    seollal: null,
    chuseok: null,
    fixedDates: [],
    irregularWeekdays: new Set(),
    noClosure: false,
    unread: false,
    unreadFragments: [],
  };
  if (!restdateRaw || !restdateRaw.trim()) return parsed;

  let text = removeHarmless(restdateRaw);
  // 예외 조항은 공휴일·요일 조각보다 먼저 통째로 읽는다 — 먼저 쪼개면 "공휴일"만 휴무로 읽힌다.
  text = take(text, REST_PALACE_EXCEPTION_RE, () => {
    parsed.holidayException = "nextDay";
  });
  text = take(text, REST_NEXT_DAY_EXCEPTION_RE, () => {
    parsed.holidayException = "nextDay";
  });
  let exclusionOnly = false;
  text = take(text, REST_OPEN_EXCEPTION_RE, (m) => {
    parsed.holidayException = parsed.holidayException ?? "open";
    if (/제외/.test(m[0])) exclusionOnly = true;
  });
  text = take(text, REST_DAY_AFTER_HOLIDAY_RE, () => {
    parsed.dayAfterHoliday = true;
  });
  text = take(text, REST_FESTIVAL_RE, (m) => {
    const scope = m[3] === "당일" ? "day" : "period";
    for (const name of [m[1], m[2]]) {
      if (!name) continue;
      if (name === "명절") {
        parsed.seollal = scope;
        parsed.chuseok = scope;
      } else if (name === "추석") parsed.chuseok = scope;
      else parsed.seollal = scope;
    }
  });
  text = take(text, REST_FIXED_DATE_RE, (m) => {
    parsed.fixedDates.push({ month: Number(m[1]), day: Number(m[2]) });
  });
  // "창립기념일 (12.9)"처럼 기념일 뒤 괄호 안의 점 표기 날짜 — 소수와 헷갈리지 않게 이 형태만 읽는다.
  text = take(text, /[가-힣]*기념일\s*[([]\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*[)\]]/g, (m) => {
    parsed.fixedDates.push({ month: Number(m[1]), day: Number(m[2]) });
  });
  text = take(text, REST_HOLIDAY_RE, () => {
    parsed.onHolidays = true;
  });
  text = take(text, REST_NO_CLOSURE_RE, () => {
    parsed.noClosure = true;
  });

  const { rest, days, irregularDays } = takeDays(text);
  parsed.irregularWeekdays = irregularDays;
  for (const d of days) {
    // restdate의 "공휴일"은 위에서 이미 읽었다. 남은 holiday 키는 무시한다.
    if (d !== "holiday") parsed.weekdays.add(d);
  }
  if (days.has("holiday")) parsed.onHolidays = true;

  // "연중무휴(공휴일 제외)"처럼 정기 휴무 요일 없이 쓰인 "공휴일 제외"는 예외 조항이 아니라
  // "공휴일엔 쉰다"는 뜻이다 — 예외로 읽으면 공휴일에 영업 중으로 단정하게 된다.
  if (parsed.holidayException === "open" && exclusionOnly && parsed.weekdays.size === 0) {
    parsed.holidayException = null;
    parsed.onHolidays = true;
  }

  const condition = visitCondition(rest, REST_NEUTRAL);
  parsed.unread = condition.length > 0;
  if (condition) parsed.unreadFragments.push(condition);
  return parsed;
}

// ─── 판정 ──────────────────────────────────────────────────────────────────────

export interface CheckOptions {
  now?: Date;
  /** 예상 체류시간(분). 넘기면 insufficient_time 판정도 함께 수행 */
  expectedDurationMinutes?: number;
  /**
   * 이 판정에 restdate라는 개념 자체가 존재하는지 여부. 기본값 true(존재함).
   * 축제 playtime 판정(selectFestival.ts)처럼 요일별 휴무 개념이 애초에 없어 restdateRaw를
   * 항상 null로 넘기는 호출부는 false를 지정해야 한다 — 그래야 "restdate 필드가 비어서
   * 휴무 여부를 모른다"는 불확실성 강등이 "이 판정엔 restdate가 원래 없다"는 정상 케이스에
   * 잘못 적용되지 않는다.
   */
  restDateApplicable?: boolean;
}

function monthIn(month: number, [start, end]: [number, number]): boolean {
  return start <= end ? month >= start && month <= end : month >= start || month <= end;
}

// 휴무 근거를 찾는다. 찾으면 사유 문자열, 없으면 null. holidayUnknown은 공휴일 표에 없는
// 연도라 공휴일 조건을 대조하지 못했다는 뜻이다.
function findClosure(
  rest: ParsedRestDate,
  now: Date,
): { reason: string | null; holidayUnknown: boolean } {
  const date = getKstDateString(now);
  const today = getKstDay(now) as Weekday;
  const yesterdayDate = getKstDateString(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const yesterday = ((today + 6) % 7) as Weekday;
  const info = getHolidayInfo(date);
  const yesterdayInfo = getHolidayInfo(yesterdayDate);

  const needsHolidays =
    rest.onHolidays ||
    rest.dayAfterHoliday ||
    rest.holidayException !== null ||
    rest.seollal !== null ||
    rest.chuseok !== null;
  const holidayUnknown = needsHolidays && (!info.known || !yesterdayInfo.known);

  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  if (rest.fixedDates.some((d) => d.month === month && d.day === day)) {
    return { reason: "오늘은 지정 휴무일입니다.", holidayUnknown };
  }

  if (!holidayUnknown) {
    for (const [festival, scope] of [
      ["seollal", rest.seollal],
      ["chuseok", rest.chuseok],
    ] as const) {
      if (!scope || info.festival !== festival) continue;
      if (scope === "period" || info.isFestivalMainDay) {
        return { reason: "오늘은 명절 휴무일입니다.", holidayUnknown };
      }
    }
    if (rest.onHolidays && info.isHoliday) {
      return { reason: "오늘은 공휴일 휴무일입니다.", holidayUnknown };
    }
    if (rest.dayAfterHoliday && yesterdayInfo.isHoliday) {
      return { reason: "공휴일 다음 날 휴무일입니다.", holidayUnknown };
    }
    if (
      rest.holidayException === "nextDay" &&
      yesterdayInfo.isHoliday &&
      rest.weekdays.has(yesterday)
    ) {
      return { reason: "정기 휴무 요일이 공휴일이라 다음 날 휴무입니다.", holidayUnknown };
    }
  }

  if (rest.weekdays.has(today)) {
    // 정기 휴무 요일이지만 공휴일 예외 조항이 있으면 공휴일엔 정상 운영이다.
    const exempt = rest.holidayException !== null && !holidayUnknown && info.isHoliday;
    if (!exempt) return { reason: "오늘은 정기 휴무일입니다.", holidayUnknown };
  }

  return { reason: null, holidayUnknown };
}

export function checkOpenByDayAwareHours(
  usetimeRaw: string | null | undefined,
  restdateRaw: string | null | undefined,
  options: CheckOptions = {},
): AvailabilityResult {
  const now = options.now ?? new Date();
  const today = getKstDay(now) as Weekday; // Asia/Seoul 기준 요일 — 서버 로컬 타임존 무관
  const restDateApplicable = options.restDateApplicable ?? true;

  let restUnread = false;
  let holidayUnknown = false;
  const unreadFragments: string[] = [];
  if (restDateApplicable) {
    const rest = parseRestDate(restdateRaw);
    const closure = findClosure(rest, now);
    if (closure.reason) return { status: "closed_restday", reason: closure.reason };
    // 매월 N째 요일 휴무는 오늘이 그 요일일 때만 영업을 단정하지 않는다 — 다른 요일엔 무관하다.
    const irregularToday = rest.irregularWeekdays.has(today);
    restUnread = rest.unread || irregularToday;
    if (irregularToday) rest.unreadFragments.push("매월 N째 주 휴무 요일");
    holidayUnknown = closure.holidayUnknown;
    unreadFragments.push(...rest.unreadFragments);
  }

  // restdateRaw 자체가 없으면 "확인해봤더니 휴무가 없다"가 아니라 "휴무 여부를 알 수 없다"이므로,
  // 시간대 조건만 맞춰서 open을 확정하면 안 된다 — 아래 open 판정에서 uncertain으로 낮춘다.
  const restDateInfoMissing = restDateApplicable && (!restdateRaw || !restdateRaw.trim());

  if (!usetimeRaw || !usetimeRaw.trim()) {
    return { status: "no_data", reason: "이용시간 정보가 등록되어 있지 않습니다." };
  }

  const parsed = parseUseTime(usetimeRaw);
  if (!parsed || parsed.rules.length === 0) {
    return { status: "uncertain", reason: "이용시간 형식을 해석할 수 없습니다." };
  }

  const date = getKstDateString(now);
  const month = Number(date.slice(5, 7));
  const holidayInfo = getHolidayInfo(date);

  const inMonth = parsed.rules.filter((r) => !r.months || monthIn(month, r.months));
  if (inMonth.length === 0) {
    return { status: "closed_restday", reason: "이번 달은 운영 기간이 아닙니다." };
  }

  let usetimeUnread = parsed.unread;
  unreadFragments.push(...parsed.unreadFragments);
  const hasHolidayRules = inMonth.some((r) => r.days?.has("holiday"));
  if (hasHolidayRules && !holidayInfo.known) usetimeUnread = true;

  const holidayRules =
    holidayInfo.known && holidayInfo.isHoliday ? inMonth.filter((r) => r.days?.has("holiday")) : [];
  let todays = holidayRules.length > 0 ? holidayRules : inMonth.filter((r) => r.days?.has(today));
  if (todays.length === 0) todays = inMonth.filter((r) => !r.days);
  if (todays.length === 0) {
    return { status: "closed_restday", reason: "오늘 이용 정보가 명시되어 있지 않습니다." };
  }

  // 오늘 적용되는 시간 구간을 합치고 휴게시간을 뺀다.
  const extension = parsed.extensions.find((e) => monthIn(month, e.months))?.minutes ?? 0;
  const lastCloseRaw = Math.max(...todays.flatMap((r) => r.ranges.map((x) => toMinutes(x.close))));
  const intervals = mergeIntervals(
    todays.flatMap((r) =>
      r.ranges.map((x) => {
        const close = toMinutes(x.close);
        return [toMinutes(x.open), close === lastCloseRaw ? Math.min(close + extension, 23 * 60 + 59) : close] as [number, number];
      }),
    ),
  );
  const breaks = todays.flatMap((r) => r.breaks.map((b) => [toMinutes(b.open), toMinutes(b.close)] as [number, number]));
  const openIntervals = subtractIntervals(intervals, breaks);
  if (openIntervals.length === 0) {
    return { status: "uncertain", reason: "이용시간 형식을 해석할 수 없습니다." };
  }

  const lastClose = openIntervals[openIntervals.length - 1][1];
  const absCutoff = todays.find((r) => r.admissionCutoff)?.admissionCutoff;
  const relCutoff =
    todays.find((r) => r.cutoffMinutesBeforeClose != null)?.cutoffMinutesBeforeClose ?? parsed.globalCutoffMinutes;
  const cutoffMinutes =
    absCutoff != null ? toMinutes(absCutoff) : relCutoff != null ? lastClose - relCutoff : lastClose;

  const nowMinutes = (now.getTime() - atTime(now, "00:00").getTime()) / 60000;
  const unread = usetimeUnread || restUnread || holidayUnknown;
  const expected = options.expectedDurationMinutes;

  const current = openIntervals.find(([open, close]) => nowMinutes >= open && nowMinutes < close);
  if (!current) {
    const next = openIntervals.find(([open]) => open > nowMinutes);
    if (next && !unread && (expected == null || lastClose - next[0] >= expected)) {
      const opensAt = atTime(now, fromMinutes(next[0]));
      const isBreak = openIntervals.some(([, close]) => close <= nowMinutes);
      return {
        status: "before_open",
        reason: isBreak
          ? `휴게시간입니다(${fromMinutes(next[0])} 재개).`
          : `아직 문을 열기 전입니다(${fromMinutes(next[0])} 개점).`,
        opensAt,
        minutesUntilOpen: Math.ceil(next[0] - nowMinutes),
        closesAt: atTime(now, fromMinutes(lastClose)),
      };
    }
    return {
      status: "closed_hours",
      reason: "지금은 이용시간이 아닙니다.",
      closesAt: atTime(now, fromMinutes(lastClose)),
      admissionCutoffAt: atTime(now, fromMinutes(cutoffMinutes)),
    };
  }

  const closesAt = atTime(now, fromMinutes(current[1]));
  const admissionCutoffAt = atTime(now, fromMinutes(Math.min(cutoffMinutes, lastClose)));

  if (nowMinutes >= cutoffMinutes) {
    return {
      status: "past_admission_cutoff",
      reason: `입장마감(${fromMinutes(cutoffMinutes)})이 지났습니다.`,
      closesAt,
      admissionCutoffAt,
    };
  }

  if (expected != null) {
    // 휴게시간이 있어도 그 뒤에 이어서 이용할 수 있으므로 하루 마지막 마감까지 남은 시간으로 본다.
    const remainingMinutes = lastClose - nowMinutes;
    if (remainingMinutes < expected) {
      return {
        status: "insufficient_time",
        reason: `폐관(${fromMinutes(lastClose)})까지 ${Math.floor(remainingMinutes)}분 남아 예상 체류시간을 채우기 어렵습니다.`,
        closesAt,
        admissionCutoffAt,
        canCompleteVisit: false,
      };
    }
  }

  if (unread) {
    return {
      status: "uncertain",
      reason: holidayUnknown
        ? "공휴일 정보가 없어 실제 운영 여부를 확인해주세요."
        : "운영시간에 해석하지 못한 조건이 있어 실제 운영 여부를 확인해주세요.",
      closesAt,
      admissionCutoffAt,
      unreadFragments,
    };
  }

  if (restDateInfoMissing) {
    return {
      status: "uncertain",
      reason: "휴무일 정보가 없어 실제 운영 여부를 확인해주세요.",
      closesAt,
      admissionCutoffAt,
    };
  }

  return {
    status: "open",
    reason: "지금 입장 가능합니다.",
    closesAt,
    admissionCutoffAt,
    ...(expected != null ? { canCompleteVisit: true } : {}),
  };
}

function mergeIntervals(list: [number, number][]): [number, number][] {
  const sorted = [...list].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [open, close] of sorted) {
    const last = merged[merged.length - 1];
    if (last && open <= last[1]) last[1] = Math.max(last[1], close);
    else merged.push([open, close]);
  }
  return merged;
}

function subtractIntervals(list: [number, number][], cuts: [number, number][]): [number, number][] {
  let result = list;
  for (const [cutOpen, cutClose] of cuts) {
    result = result.flatMap(([open, close]): [number, number][] => {
      if (cutClose <= open || cutOpen >= close) return [[open, close]];
      const parts: [number, number][] = [];
      if (cutOpen > open) parts.push([open, cutOpen]);
      if (cutClose < close) parts.push([cutClose, close]);
      return parts;
    });
  }
  return result;
}
