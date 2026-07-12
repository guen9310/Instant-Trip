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

export type AvailableItem = TourItem & { availabilityUncertain: boolean };
const BATCH_SIZE = 10;

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
// 4. 시간 범위 파싱 성공 → 현재 시각과 비교
// 5. 시간 범위 파싱 실패 → 통과 (자유 텍스트라 파싱 못하는 경우가 많음)
function checkAvailability(usetime: string, restdate: string): OpenResult {
  if (isRestDay(restdate)) {
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
  const range = parseTimeRange(usetime);
  if (!range) {
    return {
      open: true,
      reason: `파싱불가 → 통과 (원문: "${usetime.slice(0, 30)}")`,
      label: "통과(파싱실패)",
    };
  }
  const now = new Date();
  const kstHour = getKstHour(now);
  const kstMin = getKstMinute(now);
  const cur = kstHour * 60 + kstMin;
  const timeStr = `${String(kstHour).padStart(2, "0")}:${String(kstMin).padStart(2, "0")}`;
  const openStr = `${String(Math.floor(range.open / 60)).padStart(2, "0")}:${String(range.open % 60).padStart(2, "0")}`;
  const closeStr = `${String(Math.floor(range.close / 60)).padStart(2, "0")}:${String(range.close % 60).padStart(2, "0")}`;

  // 자정을 넘는 운영시간 처리: close < open이면 자정을 넘기는 케이스다.
  // 예: 22:00~02:00 → 22시 이후 또는 02시 이전이면 운영 중
  const isOpen =
    range.close < range.open
      ? cur >= range.open || cur <= range.close
      : cur >= range.open && cur <= range.close;
  return {
    open: isOpen,
    reason: `${openStr}~${closeStr} / 현재 ${timeStr}`,
    label: isOpen ? "통과(영업중)" : "제외(운영종료)",
  };
}

// [stage2] stage1에서 수집한 장소 중 현재 시각에 운영 중인 곳만 통과시킨다.
//
// - detailIntro2 API로 각 장소의 운영시간(usetime)과 휴무일(restdate)을 조회한다.
// - 10개씩 배치로 묶어 Promise.all로 병렬 처리해서 속도를 높인다.
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

    const cacheKey = `tour:detailIntro2:${item.contentid}`;
    const cachedIntro = await readCache<IntroItem>(cacheKey);

    // 이전 API 호출에서 데이터가 없었던 장소 — 재호출 없이 통과(uncertain)
    if (cachedIntro === CACHE_EMPTY) {
      passed++;
      console.log(`${prefix} → 캐시 HIT (빈 응답) → uncertain=true`);
      return { ...item, availabilityUncertain: true };
    }

    const ts = Date.now();
    let intro: IntroItem | undefined;

    if (cachedIntro !== null) {
      intro = cachedIntro;
      console.log(`${prefix} → 캐시 HIT`);
    } else {
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        errCount++;
        console.warn(`${prefix} → 통과(API오류) → uncertain=true (${Date.now() - ts}ms)`);
        // 운영시간을 확인하지 못한 채 통과시키는 것이므로 불확실 플래그를 켠다.
        return { ...item, availabilityUncertain: true };
      }
    }

    const elapsed = Date.now() - ts;

    // intro 자체가 없는 경우 (API는 성공했지만 해당 장소의 상세 정보가 DB에 없는 경우).
    // 데이터 미비로 인한 것이므로 통과시킨다.
    if (!intro) {
      passed++;
      console.log(
        `${prefix} → 통과(데이터없음) intro 자체 없음 → uncertain=true (${elapsed}ms)`,
      );
      return { ...item, availabilityUncertain: true };
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

    // 필드명과 원문값, isRestDay 입력·결과를 한 줄로 출력한다.
    const fieldLog = fields.restdate
      ? `${fields.restdate}="${restdate}" ${fields.usetime}="${usetime.slice(0, 40)}"`
      : `(알수없는타입=${item.contenttypeid})`;
    const restdayLog = `isRestDay("${restdate.slice(0, 20)}")=${restdayResult}`;

    if (result.open) {
      const uncertain =
        result.label === "통과(데이터없음)" ||
        result.label === "통과(파싱실패)";
      passed++;
      console.log(
        `${prefix} | ${fieldLog}\n         → ${restdayLog} → ${result.label} ${result.reason} → uncertain=${uncertain} (${elapsed}ms)`,
      );
      return { ...item, availabilityUncertain: uncertain };
    } else {
      blocked++;
      console.log(
        `${prefix} | ${fieldLog}\n         → ${restdayLog} → ${result.label} ${result.reason} (${elapsed}ms)`,
      );
      return null;
    }
  };

  // BATCH_SIZE(10)개씩 끊어서 병렬 처리한다.
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
