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
import { checkOpenByDayAwareHours } from "@/lib/tour/hours";
import type { AvailabilityStatus } from "@/shared/types/availability.types";
import { estimateStayDuration } from "@/lib/pipeline/stayDuration";

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
// usetime/restdate 원문을 화면에 노출하거나 lib/tour/hours.ts로 파싱을 넘기기 전
// 정리하는 용도.
export function stripBrTags(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

// 단일 장소 가용성 검사 결과 — lib/tour/hours.ts의 판정(status)과 함께 판정 근거를
// 그대로 노출한다. filterByAvailability(배치)와 장소 선택 진입(단일, 비차단) 양쪽이
// 공유하는 형태.
export type PlaceAvailabilityCheck = {
  status: AvailabilityStatus;
  reason: string;
  hours: string | null; // usetime 원문 (없으면 null)
  restDayNote: string | null; // restdate 원문 (없으면 null)
};

// [stage2 코어] 장소 1건의 운영시간(usetime)·휴무일(restdate)을 detailIntro2로 조회해
// lib/tour/hours.ts(checkOpenByDayAwareHours)로 현재 시각 기준 상태를 판정한다.
// filterByAvailability의 배치 루프와 장소 선택 진입(선택 코스 생성)의 단일 호출이
// 이 함수 하나를 공유한다 — 캐시·판정 로직 이중화 방지.
//
// API 실패("uncertain")·intro/필드 자체가 없음("no_data")은 호출부가 관대하게
// 채택할 수 있도록 구분해서 반환한다 — 어느 쪽이든 "차단"할지는 호출부가 결정한다.
export async function checkPlaceAvailability(
  item: TourItem,
  logPrefix: string,
): Promise<PlaceAvailabilityCheck> {
  const cacheKey = `tour:detailIntro2:${item.contentid}`;
  const cachedIntro = await readCache<IntroItem>(cacheKey);

  // 이전 API 호출에서 데이터가 없었던 장소 — 재호출 없이 no_data로 통과
  if (cachedIntro === CACHE_EMPTY) {
    console.log(`${logPrefix} → 캐시 HIT (빈 응답) → status=no_data`);
    return { status: "no_data", reason: "이전 조회에서 상세 정보가 없었습니다.", hours: null, restDayNote: null };
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
      console.warn(`${logPrefix} → status=uncertain(API오류) (${Date.now() - ts}ms) — ${err}`);
      // API 호출 자체가 실패해 운영시간을 확인 못 한 경우 — 데이터 부재(no_data)가 아니라
      // "확인을 시도했지만 알 수 없음"이므로 uncertain으로 구분한다.
      return { status: "uncertain", reason: "운영시간 조회 중 오류가 발생했습니다.", hours: null, restDayNote: null };
    }
  }

  const elapsed = Date.now() - ts;

  // intro 자체가 없는 경우 (API는 성공했지만 해당 장소의 상세 정보가 DB에 없는 경우).
  if (!intro) {
    console.log(`${logPrefix} → status=no_data (intro 자체 없음, ${elapsed}ms)`);
    return { status: "no_data", reason: "상세 정보가 등록되어 있지 않습니다.", hours: null, restDayNote: null };
  }

  // contentTypeId별 필드명을 INTRO_FIELDS 맵으로 조회해서 운영시간·휴무일을 추출한다.
  // 알 수 없는 타입은 빈 문자열로 처리(no_data로 귀결).
  const fields = INTRO_FIELDS[item.contenttypeid] ?? { usetime: "", restdate: "" };
  const raw = intro as unknown as Record<string, string>;
  const usetimeRaw = raw[fields.usetime] ?? "";
  const restdateRaw = raw[fields.restdate] ?? "";
  // <br> 태그를 정리한 원문을 판정과 표시 양쪽에 그대로 쓴다 — 판정용과 표시용을
  // 이중으로 관리하지 않는다.
  const usetime = usetimeRaw ? stripBrTags(usetimeRaw) : null;
  const restdate = restdateRaw ? stripBrTags(restdateRaw) : null;

  // 예상 체류시간(카테고리 평균, 분) — 폐관까지 남은 시간이 이 값보다 짧으면
  // insufficient_time으로 판정된다. estimateStayDuration은 항상 {min,max} 범위를
  // 주므로 평균을 "카테고리 평균 체류시간"으로 사용한다.
  const duration = estimateStayDuration(item);
  const expectedDurationMinutes = Math.round((duration.min + duration.max) / 2);

  const result = checkOpenByDayAwareHours(usetime, restdate, { expectedDurationMinutes });

  const fieldLog = fields.restdate
    ? `${fields.restdate}="${restdate ?? ""}" ${fields.usetime}="${(usetime ?? "").slice(0, 40)}"`
    : `(알수없는타입=${item.contenttypeid})`;
  console.log(
    `${logPrefix} | ${fieldLog} | 예상체류=${expectedDurationMinutes}분\n         → status=${result.status} ${result.reason} (${elapsed}ms)`,
  );

  return { status: result.status, reason: result.reason, hours: usetime, restDayNote: restdate };
}

// status가 "open"이 아니어도 채택 후보로 남겨두는 상태 — README의 "판정 불가한 형식은
// 보수적으로 통과시킨다" 정책. 데이터가 아예 없거나(no_data) 판정 자체가 불확실한
// 경우(uncertain)는 실제로 닫혀 있다는 근거가 없으므로 차단하지 않는다.
// closed_restday/closed_hours/past_admission_cutoff/insufficient_time은 실제로
// "닫혀 있다"는 근거가 있는 상태라 이 집합에 포함하지 않는다.
const ADOPTABLE_STATUSES: ReadonlySet<AvailabilityStatus> = new Set(["open", "no_data", "uncertain"]);

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
// - 반환값: 운영 중(또는 판정 불가로 관대 채택)으로 판단된 AvailableItem 배열
//   (availabilityUncertain 플래그 포함)
export async function filterByAvailability(
  items: TourItem[],
): Promise<AvailableItem[]> {
  const available: AvailableItem[] = [];
  const t0 = Date.now();
  let passed = 0,
    blocked = 0,
    // eslint-disable-next-line prefer-const
    skipped = 0,
    uncertainCount = 0;

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
    if (result.status !== "open") uncertainCount++;

    if (ADOPTABLE_STATUSES.has(result.status)) {
      passed++;
      return {
        ...item,
        availabilityUncertain: result.status !== "open",
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
    `[stage2] 완료 — 통과 ${passed} / 제외 ${blocked} / 행사위임 ${skipped} / 불확실통과 ${uncertainCount}` +
      ` → ${available.length}건 (총 ${Date.now() - t0}ms)`,
  );
  return available;
}
