import { tourFetch, extractItems } from "@/lib/tour/client";
import { readCache, writeCache } from "@/lib/tour/cache";
import { ENDPOINTS } from "@/lib/tour/endpoints";
import type { TourItem, TourDetailIntroAttraction, TourDetailIntroRestaurant } from "@/lib/tour/types";

// 운영시간·휴무일 정보는 자주 바뀌지 않으므로 24시간 캐시해도 무방하다.
const INTRO_TTL = 24 * 60 * 60 * 1000; // 24시간
const BATCH_SIZE = 10;

type IntroItem = TourDetailIntroAttraction | TourDetailIntroRestaurant;

// "09:00~18:00" 또는 "9시~18시" 형식의 운영시간 문자열을 파싱해서
// { open: 분 단위 시작, close: 분 단위 종료 } 형태로 반환한다.
// 파싱에 실패하면 null을 반환한다 (호출부에서 통과 처리).
export function parseTimeRange(usetime: string): { open: number; close: number } | null {
  const colonMatch = usetime.match(/(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})/);
  if (colonMatch) {
    return {
      open:  parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]),
      close: parseInt(colonMatch[3]) * 60 + parseInt(colonMatch[4]),
    };
  }
  const hourMatch = usetime.match(/(\d{1,2})시\s*[~\-]\s*(\d{1,2})시/);
  if (hourMatch) {
    return { open: parseInt(hourMatch[1]) * 60, close: parseInt(hourMatch[2]) * 60 };
  }
  return null;
}

// 요일 완전어 패턴 — 단일 문자 매칭 대신 "N요일" 전체를 기준으로 검사해서
// "매일", "공휴일", "매월" 같은 비요일 문맥의 오탐을 방지한다.
const DAY_PATTERNS: RegExp[] = [
  /일요일/, /월요일/, /화요일/, /수요일/, /목요일/, /금요일/, /토요일/,
];

// restdate 문자열에 오늘 요일(완전어)이 포함되어 있으면 휴무로 판단한다.
// 예: "매주 월요일" → 월요일에 true / "매일 운영" → 일요일에도 false
// 한계: "월·화", "격주 월요일", "매월 N번째 요일" 같은 복잡 표기는 탐지 불가 → 통과 처리됨
// dayIndex: 0=일, 1=월, ..., 6=토 (테스트 시 주입 가능)
export function isRestDay(restdate: string, dayIndex: number = new Date().getDay()): boolean {
  if (!restdate) return false;
  return DAY_PATTERNS[dayIndex].test(restdate);
}

type OpenResult =
  | { open: true;  reason: string }
  | { open: false; reason: string };

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
    return { open: false, reason: `휴무일 (${restdate.slice(0, 20)})` };
  }
  if (!usetime) {
    return { open: true, reason: "이용시간 데이터 없음 → 통과" };
  }
  const lower = usetime.toLowerCase();
  if (lower.includes("24시간") || lower.includes("연중무휴")) {
    return { open: true, reason: "24시간/연중무휴" };
  }
  const range = parseTimeRange(usetime);
  if (!range) {
    return { open: true, reason: `파싱불가 → 통과 (원문: "${usetime.slice(0, 30)}")` };
  }
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const timeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  const openStr = `${String(Math.floor(range.open/60)).padStart(2,"0")}:${String(range.open%60).padStart(2,"0")}`;
  const closeStr = `${String(Math.floor(range.close/60)).padStart(2,"0")}:${String(range.close%60).padStart(2,"0")}`;

  // 자정을 넘는 운영시간 처리: close < open이면 자정을 넘기는 케이스다.
  // 예: 22:00~02:00 → 22시 이후 또는 02시 이전이면 운영 중
  const isOpen = range.close < range.open
    ? cur >= range.open || cur <= range.close
    : cur >= range.open && cur <= range.close;
  return {
    open: isOpen,
    reason: `${openStr}~${closeStr} / 현재 ${timeStr} → ${isOpen ? "운영중" : "운영종료"}`,
  };
}

// [stage2] stage1에서 수집한 장소 중 현재 시각에 운영 중인 곳만 통과시킨다.
//
// - detailIntro2 API로 각 장소의 운영시간(usetime)과 휴무일(restdate)을 조회한다.
// - 10개씩 배치로 묶어 Promise.all로 병렬 처리해서 속도를 높인다.
// - 행사(contenttypeid=15)는 운영시간 개념이 없으므로 이 단계를 건너뛰고 stage3에서 처리한다.
// - API 실패 시에도 해당 장소를 통과시킨다 (코스 생성이 멈추는 것보다 낫다).
// - 반환값: 운영 중으로 판단된 TourItem 배열 (이후 stage4로 전달됨)
export async function filterByAvailability(items: TourItem[]): Promise<TourItem[]> {
  const available: TourItem[] = [];
  const t0 = Date.now();
  let passed = 0, blocked = 0, skipped = 0, errCount = 0;

  console.log(`[stage2] ${items.length}건 가용성 검사 시작 (배치 ${BATCH_SIZE})`);

  const checkItem = async (item: TourItem, globalIdx: number): Promise<TourItem | null> => {
    const idx = `[${globalIdx + 1}/${items.length}]`;

    const cacheKey = `intro_${item.contentid}`;
    const cachedIntro = readCache<IntroItem>(cacheKey, INTRO_TTL);

    const ts = Date.now();
    let intro: IntroItem | undefined;

    if (cachedIntro) {
      intro = cachedIntro;
      console.log(`[stage2] ${idx} "${item.title}" — 캐시 hit`);
    } else {
      try {
        const data = await tourFetch<IntroItem>(ENDPOINTS.DETAIL_INTRO, {
          contentId: item.contentid,
          contentTypeId: item.contenttypeid,
        });
        intro = extractItems(data)[0];
        if (intro) writeCache(cacheKey, intro);
      } catch (err) {
        errCount++;
        console.warn(`[stage2] ${idx} "${item.title}" — detailIntro2 실패, 통과 처리 (${Date.now() - ts}ms)`);
        return item;
      }
    }

    const elapsed = Date.now() - ts;

    // intro 자체가 없는 경우 (API는 성공했지만 해당 장소의 상세 정보가 DB에 없는 경우).
    // 데이터 미비로 인한 것이므로 통과시킨다.
    if (!intro) {
      passed++;
      console.log(`[stage2] ${idx} "${item.title}" — intro 없음, 통과 (${elapsed}ms)`);
      return item;
    }

    // 관광지는 usetime/restdate, 음식점은 opentimefood/restdatefood 필드명이 다르다.
    // 두 타입을 통합해서 처리하기 위해 각각 시도하고 없으면 빈 문자열로 처리한다.
    const usetime  = (intro as TourDetailIntroAttraction).usetime   ?? (intro as TourDetailIntroRestaurant).opentimefood  ?? "";
    const restdate = (intro as TourDetailIntroAttraction).restdate  ?? (intro as TourDetailIntroRestaurant).restdatefood  ?? "";
    const result   = checkAvailability(usetime, restdate);

    if (result.open) {
      passed++;
      console.log(`[stage2] ${idx} "${item.title}" ✓ ${result.reason} (${elapsed}ms)`);
      return item;
    } else {
      blocked++;
      console.log(`[stage2] ${idx} "${item.title}" ✗ ${result.reason} (${elapsed}ms)`);
      return null;
    }
  };

  // BATCH_SIZE(10)개씩 끊어서 병렬 처리한다.
  // 한꺼번에 전부 병렬 처리하면 API 레이트 리밋에 걸릴 수 있어서 배치로 나눈다.
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((item, j) => checkItem(item, i + j)));
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
