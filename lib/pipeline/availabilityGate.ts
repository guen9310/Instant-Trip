import { checkPlaceAvailability } from "@/lib/pipeline/availability";
import type { PlaceCandidate } from "@/lib/pipeline/types";
import type { AvailabilityStatus } from "@/shared/types/availability.types";

// status가 "open"이 아니어도 채택하는 상태 — README의 "판정 불가한 형식은 보수적으로
// 통과시킨다" 정책. no_data/uncertain은 실제로 닫혀 있다는 근거가 없으므로 다음 순위로
// 넘기지 않고 그 자리에서 채택한다(availabilityUncertain=true로 표시). closed_restday/
// closed_hours/past_admission_cutoff/insufficient_time만 "실제로 닫혀 있다"는 근거가
// 있는 상태라 다음 순위 후보로 넘어간다.
const ADOPTABLE_STATUSES: ReadonlySet<AvailabilityStatus> = new Set(["open", "no_data", "uncertain"]);

// "시간이 안 맞아요" 거절 리롤 전용 — no_data/uncertain("판단 불가")까지 관대하게
// 채택하는 기본 정책 대신, 실측으로 "open"이 확인된 후보만 인정한다. Kakao 출처는
// 운영시간 데이터가 없어 열림을 확인할 방법이 없으므로 이 모드에서는 채택하지 않는다 —
// 화면이 "지금 확실히 운영 중이에요"라고 주장하는 근거가 이 모드의 판정뿐이기 때문이다.
const STRICT_ADOPTABLE_STATUSES: ReadonlySet<AvailabilityStatus> = new Set(["open"]);

// 곧 여는 곳(before_open)을 후보로 남기는 창. 개점(또는 휴게 후 재개)까지 이 시간 안이면
// "지금 출발하면 도착할 즈음 연다"고 보고 채택한다. 파이프라인에 이동시간 데이터가 없어
// 거리로 추정하지 않고 보수적인 고정값을 쓴다 — 늘리면 문 앞에서 기다리는 시간이 길어진다.
export const BEFORE_OPEN_ADOPT_WINDOW_MINUTES = 30;

// 순차 확인 상한. 이 개수까지 확인해도 채택할 후보가 없으면, 상한 때문에 아직 확인하지
// 못한 후보 중 최상위를 관대하게(uncertain=true) 채택한다 — API 오류 시 관대 통과와 같은
// 철학. 이미 닫혔다고 확인한 후보는 폴백으로도 되살리지 않는다.
export const MAX_AVAILABILITY_CHECKS = 30;

export type AvailabilityGateResult = {
  winner: PlaceCandidate;
  checksPerformed: number; // 실제로 detailIntro2를 호출한 횟수 (Kakao 즉시채택은 미포함)
  exhausted: boolean; // true = 상한 소진 → 확인하지 못한 후보 중 최상위 폴백
};

// [stage2/4 순서 반전] 점수화(stage4)를 마친 후보를 점수 내림차순으로 순회하며
// 하나씩만 운영시간을 확인해서 최초로 "열려있음"인 후보를 채택한다.
//
// stage4(scoreCandidates)는 운영시간 데이터를 전혀 쓰지 않으므로, 기존처럼 stage1
// 수집분 전체(80~120건)에 detailIntro2를 미리 다 호출할 필요가 없다 — 점수 순으로
// 하나씩 확인해 첫 성공에서 멈추면 보통 1~수 건으로 끝난다(TourAPI 일일 호출 한도 절감).
//
// - Kakao 출처 후보는 운영시간 데이터가 없어 검사 없이 즉시 채택하되, 열려 있다고 확인한
//   게 아니므로 availabilityUncertain=true로 표시한다(strict 모드에서는 채택하지 않음).
// - 채택할 후보가 없으면 null — 호출부가 기존 "후보 없음" 안내로 연결한다.
// - 순차(sequential) 호출이다 — 배치 병렬이 아니다. Case 3(동시성 워커 풀) 실험에서
//   TourAPI가 지속적인 동시 부하에 취약하다는 게 확인됐으므로, 여기서도 병렬화하지 않는다.
export async function selectAvailableCandidate(
  scored: PlaceCandidate[],
  opts: { maxChecks?: number; logPrefix?: string; strictOpenOnly?: boolean } = {},
): Promise<AvailabilityGateResult | null> {
  const maxChecks = opts.maxChecks ?? MAX_AVAILABILITY_CHECKS;
  const logPrefix = opts.logPrefix ?? "[gate]";
  const adoptableStatuses = opts.strictOpenOnly ? STRICT_ADOPTABLE_STATUSES : ADOPTABLE_STATUSES;
  if (scored.length === 0) return null;

  let checksPerformed = 0;
  // 상한 때문에 확인하지 못하고 남은 첫 후보의 위치 — 폴백은 여기서부터만 고른다.
  let firstUncheckedIndex: number | null = null;

  for (let i = 0; i < scored.length; i++) {
    const candidate = scored[i];
    const { item } = candidate;

    if (item.source === "kakao") {
      if (opts.strictOpenOnly) {
        console.log(
          `${logPrefix} [${i + 1}/${scored.length}] "${item.title}" kakao 출처 → 운영 여부 확인 불가, strict 모드라 건너뜀`,
        );
        continue;
      }
      console.log(
        `${logPrefix} [${i + 1}/${scored.length}] "${item.title}" kakao 출처 → 검사 스킵, 확인 필요로 채택`,
      );
      return {
        winner: { ...candidate, availabilityUncertain: true },
        checksPerformed,
        exhausted: false,
      };
    }

    if (checksPerformed >= maxChecks) {
      console.log(`${logPrefix} 상한(${maxChecks}) 도달 — 이후 후보는 확인하지 않음`);
      firstUncheckedIndex = i;
      break;
    }

    checksPerformed++;
    const prefix = `${logPrefix} [${i + 1}/${scored.length}] (검사 ${checksPerformed}/${maxChecks}) "${item.title}"`;
    const result = await checkPlaceAvailability(item, prefix);

    if (adoptableStatuses.has(result.status)) {
      return {
        winner: {
          ...candidate,
          availabilityUncertain: result.status !== "open",
          hours: result.hours,
          restDayNote: result.restDayNote,
        },
        checksPerformed,
        exhausted: false,
      };
    }

    // 곧 여는 곳 — 기본 모드에서만 채택한다. "시간이 안 맞아요" 리롤(strict)은 지금 확실히
    // 열려 있는 곳만 원하므로 제외한다. 운영시간을 읽어낸 결과라 availabilityUncertain은 false다.
    if (
      !opts.strictOpenOnly &&
      result.status === "before_open" &&
      result.opensAt &&
      (result.minutesUntilOpen ?? Infinity) <= BEFORE_OPEN_ADOPT_WINDOW_MINUTES
    ) {
      return {
        winner: {
          ...candidate,
          availabilityUncertain: false,
          hours: result.hours,
          restDayNote: result.restDayNote,
          opensAt: result.opensAt,
        },
        checksPerformed,
        exhausted: false,
      };
    }
    // closed_restday/closed_hours/past_admission_cutoff/insufficient_time, 창 밖의 before_open
    // → 다음 순위 후보로 계속
  }

  // 확인한 후보가 모두 닫혀 있었음 — 닫혔다고 확인한 곳은 되살리지 않는다.
  // strict 모드는 확인된 open만 인정하므로, 확인하지 못한 후보로도 폴백하지 않는다.
  if (firstUncheckedIndex === null || opts.strictOpenOnly) {
    console.log(`${logPrefix} 채택 가능한 후보 없음 (검사 ${checksPerformed}건)`);
    return null;
  }

  // 상한 소진 — 아직 확인하지 않은(닫혔다는 근거가 없는) 후보 중 최상위를 관대하게 채택한다.
  // hours/restDayNote는 확인되지 않았으므로 건드리지 않고(정직하게 null 유지),
  // availabilityUncertain만 true로 표시해 화면에서 "확인 필요"로 노출되게 한다.
  const fallback = scored[firstUncheckedIndex];
  console.log(
    `${logPrefix} 상한소진 — 미확인 후보 "${fallback.item.title}" 폴백 채택 (uncertain=true)`,
  );
  return {
    winner: { ...fallback, availabilityUncertain: true },
    checksPerformed,
    exhausted: true,
  };
}
