/**
 * lib/tour/hours.ts
 *
 * TourAPI detailIntro2의 usetime(이용시간)/restdate(휴무일) 원문을
 * 요일 인지 방식으로 해석해 "지금 갈 수 있는지"를 판정한다.
 *
 * v2 변경사항 (실제 TourAPI 샘플 15건 기준 반영):
 *  - usetime/restdate가 null인 경우가 매우 흔함(샘플 60%) → 'no_data'로 별도 구분
 *  - "화~금" 같은 요일 범위 표기 지원
 *  - "N시간 전 입장마감" 같은 상대적 입장마감 지원
 *  - "상시 출입가능" 같은 상시개방 표기 지원
 *  - "토,일 09:00-17:00"처럼 콤마로 묶인 요일 목록이 깨지지 않도록 분리 로직 수정
 *
 * 타임존 안전성: "지금" 판정은 서버 런타임 타임존과 무관하게 항상 KST(Asia/Seoul)
 * 기준이어야 한다 — 이 프로젝트는 프로덕션 런타임이 KST가 아닐 수 있다는 전제(실제로
 * 같은 날 다른 파일에서 이 문제로 버그가 발생해 수정된 바 있다 — server/mappers.ts의
 * formatDate)로 항상 shared/utils/kst.ts(Intl 기반, Asia/Seoul 명시)를 쓴다. 아래
 * atTime()과 checkOpenByDayAwareHours()의 요일 계산이 Date.prototype.getDay()/setHours()
 * 대신 getKstDay()/getKstDateString()을 쓰는 이유가 이것이다 — options.now로 넘어오는
 * Date 자체는 항상 올바른 절대 시각(epoch ms)이므로, 그 시각을 KST 캘린더로 해석하는
 * 부분만 명시적으로 고정하면 서버가 어느 타임존에서 돌든 결과가 같다.
 */

import { getKstDay, getKstDateString } from "@/shared/utils/kst";
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
}

interface DayHours {
  open: string; // "10:00"
  close: string; // "18:00"
  admissionCutoff?: string; // "17:00" (없으면 close와 동일 취급)
}

interface ParsedHours {
  /** 요일별로 다른 시간이 명시된 경우 */
  byDay: Partial<Record<Weekday, DayHours>>;
  /** 요일 구분 없이 적용되는 기본 시간 (byDay에 없는 요일에 사용) */
  default?: DayHours;
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

const WEEKDAY_KEYWORDS: Record<string, Weekday[]> = {
  일: [0],
  월: [1],
  화: [2],
  수: [3],
  목: [4],
  금: [5],
  토: [6],
  매일: [0, 1, 2, 3, 4, 5, 6],
  주중: [1, 2, 3, 4, 5],
  평일: [1, 2, 3, 4, 5],
  주말: [0, 6],
};

const TIME_RANGE_RE = /([0-2]?\d)[:시]\s*(\d{2})?\s*[~\-]\s*([0-2]?\d)[:시]\s*(\d{2})?/;
const ADMISSION_CUTOFF_ABS_RE = /입장\s*마감[^0-9]*([0-2]?\d)[:시]\s*(\d{2})?/;
const ADMISSION_CUTOFF_REL_RE = /(\d+)\s*(시간|분)\s*전\s*입장\s*마감/;
const DAY_RANGE_RE = /([월화수목금토일])\s*[~\-]\s*([월화수목금토일])/;
const ALWAYS_OPEN_RE = /상시.*(출입가능|개방|이용가능|이용)|(?:출입가능|개방|이용가능|이용).*상시/;

function toHHMM(h: string, m?: string): string {
  return `${h.padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
}

function subtractMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  let total = h * 60 + m - minutes;
  if (total < 0) total += 24 * 60;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** "월~금" -> [1,2,3,4] (Weekday 배열)로 확장. "월~일"처럼 전체를 덮으면 7일 전부 반환. */
function expandDayRange(seg: string): Weekday[] | null {
  const m = seg.match(DAY_RANGE_RE);
  if (!m) return null;
  const startIdx = WEEK_DISPLAY_ORDER.indexOf(m[1]);
  const endIdx = WEEK_DISPLAY_ORDER.indexOf(m[2]);
  if (startIdx === -1 || endIdx === -1) return null;

  const days: Weekday[] = [];
  let i = startIdx;
  for (let step = 0; step < 7; step++) {
    days.push(DAY_CHAR_TO_WEEKDAY[WEEK_DISPLAY_ORDER[i]]);
    if (i === endIdx) break;
    i = (i + 1) % 7;
  }
  return days;
}

/**
 * usetime 원문을 파싱한다.
 * null/빈 문자열/파싱 실패 시 null 반환 -> 호출부에서 no_data/uncertain으로 분기.
 */
export function parseUseTime(usetimeRaw: string | null | undefined): ParsedHours | null {
  if (!usetimeRaw || !usetimeRaw.trim()) return null;

  // "화~금 09:00~17:30, 토 일 09:00~21:00" 처럼 시간대 뒤에 오는 콤마만 줄 구분자로 취급.
  // "토,일 09:00-17:00"처럼 요일을 나열하는 콤마는 분리하면 안 되므로,
  // 콤마 앞이 숫자(시간의 일부)일 때만 분리한다.
  const segments = usetimeRaw
    .split(/\n|\/|(?<=\d)\s*,\s*(?=[월화수목금토일주중주말평일])/)
    .map((s) => s.trim())
    .filter(Boolean);

  // "(이용시간 1시간 전 입장마감)" 처럼 문자열 뒤에 한 번만 적힌 안내가
  // 사실은 모든 요일 구간에 공통 적용되는 경우가 있다 (예: 월~금/토일이 따로
  // 나뉘어 있어도 마감 규칙 자체는 공통). 세그먼트 자체엔 지역적인 마감 표기가
  // 없을 때만 이 전역 규칙을 fallback으로 적용한다.
  const globalRelMatch = usetimeRaw.match(ADMISSION_CUTOFF_REL_RE);
  const globalRelMinutes = globalRelMatch
    ? Number(globalRelMatch[1]) * (globalRelMatch[2] === "시간" ? 60 : 1)
    : null;

  const result: ParsedHours = { byDay: {} };
  let matchedAny = false;

  for (const seg of segments) {
    // 상시 개방 표기 우선 처리 (시간 패턴이 없는 게 정상)
    if (ALWAYS_OPEN_RE.test(seg)) {
      matchedAny = true;
      const dayHours: DayHours = { open: "00:00", close: "23:59" };
      const rangeDays = expandDayRange(seg);
      if (rangeDays) {
        rangeDays.forEach((d) => (result.byDay[d] = dayHours));
      } else {
        result.default = dayHours;
      }
      continue;
    }

    const timeMatch = seg.match(TIME_RANGE_RE);
    if (!timeMatch) continue;

    matchedAny = true;
    const open = toHHMM(timeMatch[1], timeMatch[2]);
    const close = toHHMM(timeMatch[3], timeMatch[4]);

    let admissionCutoff: string | undefined;
    const relMatch = seg.match(ADMISSION_CUTOFF_REL_RE);
    if (relMatch) {
      const amount = Number(relMatch[1]);
      const minutes = relMatch[2] === "시간" ? amount * 60 : amount;
      admissionCutoff = subtractMinutes(close, minutes);
    } else {
      const absMatch = seg.match(ADMISSION_CUTOFF_ABS_RE);
      if (absMatch) {
        admissionCutoff = toHHMM(absMatch[1], absMatch[2]);
      } else if (globalRelMinutes != null) {
        // 이 세그먼트엔 지역적 마감 표기가 없지만, 문자열 전체의 공통 규칙이 있으면 적용
        admissionCutoff = subtractMinutes(close, globalRelMinutes);
      }
    }

    const dayHours: DayHours = { open, close, admissionCutoff };

    // 요일 범위 표기("화~금")를 요일 단일 키워드 스캔보다 우선한다.
    const rangeDays = expandDayRange(seg);
    if (rangeDays) {
      rangeDays.forEach((d) => (result.byDay[d] = dayHours));
      continue;
    }

    let matchedDays: Weekday[] = [];
    for (const [kw, days] of Object.entries(WEEKDAY_KEYWORDS)) {
      if (seg.includes(kw)) matchedDays = [...matchedDays, ...days];
    }

    if (matchedDays.length > 0) {
      for (const d of new Set(matchedDays)) {
        result.byDay[d] = dayHours;
      }
    } else {
      result.default = dayHours;
    }
  }

  if (!matchedAny) return null;
  return result;
}

/**
 * restdate 원문에서 "매주 X요일" 패턴만 추출한다.
 * "공휴일", "임시휴관일" 등 날짜 계산이 필요한 휴무는 이 함수 책임 밖 —
 * 별도로 공휴일 API/데이터와 대조해야 한다.
 */
export function parseRestDate(restdateRaw: string | null | undefined): Weekday[] {
  if (!restdateRaw) return [];
  const closed = new Set<Weekday>();
  for (const [kw, days] of Object.entries(WEEKDAY_KEYWORDS)) {
    if (kw === "매일" || kw === "주중" || kw === "평일" || kw === "주말") continue;
    if (restdateRaw.includes(`매주 ${kw}`) || restdateRaw.includes(`매주${kw}`)) {
      days.forEach((d) => closed.add(d));
    }
  }
  return [...closed];
}

// hh:mm을 base가 속한 KST 캘린더 날짜의 그 시각(KST)으로 변환한 절대 시각(Date)을 만든다.
// Date.prototype.setHours()는 런타임 로컬 타임존을 쓰므로 프로덕션 서버가 KST가 아니면
// (예: UTC) 완전히 다른 절대 시각이 나온다 — 명시적으로 +09:00 오프셋을 박아 이 문제를 피한다.
function atTime(base: Date, hhmm: string): Date {
  const dateStr = getKstDateString(base); // "YYYY-MM-DD", Asia/Seoul 기준
  return new Date(`${dateStr}T${hhmm}:00+09:00`);
}

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

export function checkOpenByDayAwareHours(
  usetimeRaw: string | null | undefined,
  restdateRaw: string | null | undefined,
  options: CheckOptions = {}
): AvailabilityResult {
  const now = options.now ?? new Date();
  const today = getKstDay(now) as Weekday; // Asia/Seoul 기준 요일 — 서버 로컬 타임존 무관

  const closedDays = parseRestDate(restdateRaw);
  if (closedDays.includes(today)) {
    return { status: "closed_restday", reason: "오늘은 정기 휴무일입니다." };
  }

  // restdateRaw 자체가 없으면 parseRestDate가 "휴무일 없음"과 구분 없이 []를 반환한다.
  // 이는 "확인해봤더니 휴무가 없다"가 아니라 "휴무 여부를 알 수 없다"이므로, 이 상태로
  // 시간대 조건만 맞춰서 open을 확정하면 안 된다 — 아래 open 판정 분기에서 uncertain으로
  // 강등시킨다 (판정 자체를 막지는 않는다: no_data/uncertain과 마찬가지로 호출부가
  // 관대하게 채택할 수 있는 상태).
  const restDateInfoMissing =
    (options.restDateApplicable ?? true) && (!restdateRaw || !restdateRaw.trim());

  if (!usetimeRaw || !usetimeRaw.trim()) {
    return { status: "no_data", reason: "이용시간 정보가 등록되어 있지 않습니다." };
  }

  const parsed = parseUseTime(usetimeRaw);
  if (!parsed) {
    return { status: "uncertain", reason: "이용시간 형식을 해석할 수 없습니다." };
  }

  const todayHours = parsed.byDay[today] ?? parsed.default;
  if (!todayHours) {
    if (Object.keys(parsed.byDay).length > 0) {
      return { status: "closed_restday", reason: "오늘 이용 정보가 명시되어 있지 않습니다." };
    }
    return { status: "uncertain", reason: "오늘 요일에 해당하는 이용시간을 찾을 수 없습니다." };
  }

  const closesAt = atTime(now, todayHours.close);
  const admissionCutoffAt = atTime(now, todayHours.admissionCutoff ?? todayHours.close);
  const opensAt = atTime(now, todayHours.open);

  if (now < opensAt || now >= closesAt) {
    return { status: "closed_hours", reason: "지금은 이용시간이 아닙니다.", closesAt, admissionCutoffAt };
  }

  if (now >= admissionCutoffAt) {
    return {
      status: "past_admission_cutoff",
      reason: `입장마감(${todayHours.admissionCutoff ?? todayHours.close})이 지났습니다.`,
      closesAt,
      admissionCutoffAt,
    };
  }

  if (options.expectedDurationMinutes != null) {
    const remainingMinutes = (closesAt.getTime() - now.getTime()) / 60000;
    const canCompleteVisit = remainingMinutes >= options.expectedDurationMinutes;
    if (!canCompleteVisit) {
      return {
        status: "insufficient_time",
        reason: `폐관(${todayHours.close})까지 ${Math.floor(remainingMinutes)}분 남아 예상 체류시간을 채우기 어렵습니다.`,
        closesAt,
        admissionCutoffAt,
        canCompleteVisit: false,
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
    return { status: "open", reason: "지금 입장 가능합니다.", closesAt, admissionCutoffAt, canCompleteVisit: true };
  }

  if (restDateInfoMissing) {
    return {
      status: "uncertain",
      reason: "휴무일 정보가 없어 실제 운영 여부를 확인해주세요.",
      closesAt,
      admissionCutoffAt,
    };
  }

  return { status: "open", reason: "지금 입장 가능합니다.", closesAt, admissionCutoffAt };
}
