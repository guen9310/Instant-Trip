import { checkPlaceAvailability } from "@/lib/pipeline/availability";
import type { PlaceCandidate } from "@/lib/pipeline/types";

// 순차 확인 상한. 점수 순으로 이 개수까지 확인해도 전부 운영종료로 판정되면
// 점수 1위를 관대하게(uncertain=true) 채택한다 — API 오류 시 관대 통과와 같은 철학.
export const MAX_AVAILABILITY_CHECKS = 30;

export type AvailabilityGateResult = {
  winner: PlaceCandidate;
  checksPerformed: number; // 실제로 detailIntro2를 호출한 횟수 (Kakao 즉시채택은 미포함)
  exhausted: boolean; // true = 상한 소진 또는 후보 소진 → 1위 폴백
};

// [stage2/4 순서 반전] 점수화(stage4)를 마친 후보를 점수 내림차순으로 순회하며
// 하나씩만 운영시간을 확인해서 최초로 "열려있음"인 후보를 채택한다.
//
// stage4(scoreCandidates)는 운영시간 데이터를 전혀 쓰지 않으므로, 기존처럼 stage1
// 수집분 전체(80~120건)에 detailIntro2를 미리 다 호출할 필요가 없다 — 점수 순으로
// 하나씩 확인해 첫 성공에서 멈추면 보통 1~수 건으로 끝난다(TourAPI 일일 호출 한도 절감).
//
// - Kakao 출처 후보는 운영시간 개념이 없으므로 검사 없이 즉시 채택한다.
// - 순차(sequential) 호출이다 — 배치 병렬이 아니다. Case 3(동시성 워커 풀) 실험에서
//   TourAPI가 지속적인 동시 부하에 취약하다는 게 확인됐으므로, 여기서도 병렬화하지 않는다.
export async function selectAvailableCandidate(
  scored: PlaceCandidate[],
  opts: { maxChecks?: number; logPrefix?: string } = {},
): Promise<AvailabilityGateResult | null> {
  const maxChecks = opts.maxChecks ?? MAX_AVAILABILITY_CHECKS;
  const logPrefix = opts.logPrefix ?? "[gate]";
  if (scored.length === 0) return null;

  let checksPerformed = 0;

  for (let i = 0; i < scored.length; i++) {
    const candidate = scored[i];
    const { item } = candidate;

    if (item.source === "kakao") {
      console.log(
        `${logPrefix} [${i + 1}/${scored.length}] "${item.title}" kakao 출처 → 검사 스킵, 즉시 채택`,
      );
      return { winner: candidate, checksPerformed, exhausted: false };
    }

    if (checksPerformed >= maxChecks) {
      console.log(`${logPrefix} 상한(${maxChecks}) 도달 — 이후 후보는 확인하지 않음`);
      break;
    }

    checksPerformed++;
    const prefix = `${logPrefix} [${i + 1}/${scored.length}] (검사 ${checksPerformed}/${maxChecks}) "${item.title}"`;
    const result = await checkPlaceAvailability(item, prefix);

    if (result.open) {
      return {
        winner: {
          ...candidate,
          availabilityUncertain: result.uncertain,
          hours: result.hours,
          restDayNote: result.restDayNote,
        },
        checksPerformed,
        exhausted: false,
      };
    }
    // closed → 다음 순위 후보로 계속
  }

  // 전원 운영종료로 판정됐거나 상한을 소진함 — 점수 1위를 관대하게 채택한다.
  // hours/restDayNote는 확인되지 않았으므로 건드리지 않고(정직하게 null 유지),
  // availabilityUncertain만 true로 덮어써 화면에서 "확인 필요"로 노출되게 한다.
  const fallback = scored[0];
  console.log(
    `${logPrefix} 전원 운영종료/상한소진 — 1위 "${fallback.item.title}" 폴백 채택 (uncertain=true)`,
  );
  return {
    winner: { ...fallback, availabilityUncertain: true },
    checksPerformed,
    exhausted: true,
  };
}
