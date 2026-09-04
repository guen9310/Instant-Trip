import type { PlaceCandidate, UserProfile } from "@/lib/pipeline/types";
import type { ConcentrationSwitchReason } from "@/shared/types/course.types";
import {
  fetchDistrictConcentration,
  latestByName,
  normalizeName,
} from "@/lib/clients/tatsCnctrRate";

// scoring.ts의 W.distance(0.25)보다 작은 소프트 보정 — 집중률 하나로 순위를
// 뒤집기보다 다른 신호와 같이 작동하도록. weatherGate의 WEATHER_PENALTY와
// 같은 자릿수(0.10~0.20).
export const CONCENTRATION_MAX_ADJUST = 0.15;

// 배너 노출 판정 기준 — 집중률(0~100)을 100으로 나눈 비율이 이 값 미만이면
// "한산함", 이상이면 "붐빔"으로 분류한다.
const CROWD_THRESHOLD_RATIO = 0.5;

// 채택된 장소(winner)의 실측 집중률이 온보딩 vibe 방향과 부합할 때만 배너 사유를
// 반환한다 — quiet인데 winner가 오히려 붐비는 경우처럼 방향과 실측이 어긋나면
// null(모순된 문구를 보여주지 않기 위함). winnerRate가 없으면(매칭 안 됨) 항상 null.
export function deriveConcentrationSwitchReason(
  direction: ConcentrationSwitchReason,
  winnerRate: number | null | undefined,
): ConcentrationSwitchReason | null {
  if (winnerRate == null) return null;
  const ratio = winnerRate / 100;
  if (direction === "quiet" && ratio < CROWD_THRESHOLD_RATIO) return "quiet";
  if (direction === "lively" && ratio >= CROWD_THRESHOLD_RATIO) return "lively";
  return null;
}

export interface ConcentrationGateResult {
  scored: PlaceCandidate[]; // 재정렬된 새 배열 — 원본 배열은 변경하지 않는다
  direction: ConcentrationSwitchReason;
  matchedCount: number;
  districtCount: number;
}

// stage4(점수화) 직후에 호출한다 — weatherGate와 같은 자리. 호출 여부(on/off) 자체는
// 이 함수가 아니라 index.ts가 CONCENTRATION_GATE_ENABLED로 판단한다 — 이 함수는
// 항상 켜졌다고 가정하고 동작만 담당한다(weatherGate가 날씨 신호를 모르는 순수
// 함수인 것과 같은 분리).
// 온보딩 "장소 분위기"(vibe: quiet|lively)는 둘 중 하나를 강제 선택하는
// 이지선다라 무응답 상태가 없다 — tagWeights.조용함이 0이면 항상 "활기찬 곳"을
// 고른 것으로 해석한다([shared/constants/preferences.ts]의 vibe 옵션 참고).
//
// 집중률 조회는 후보 1건당이 아니라 시군구(법정동 areaCd+signguCd) 1건당
// 1회다 — locationBasedList2 응답에 이미 lDongRegnCd/lDongSignguCd가 실려
// 있어(2026-09-03 실측 확인) 별도 조회 없이 바로 그룹핑할 수 있다.
export async function applyConcentrationGate(
  scored: PlaceCandidate[],
  profile: UserProfile,
): Promise<ConcentrationGateResult> {
  const quietWeight = profile.tagWeights["조용함"] ?? 0;
  const direction: ConcentrationSwitchReason = quietWeight > 0 ? "quiet" : "lively";

  // 후보들의 법정동 지역 distinct 집합 — 지역당 1회만 조회한다.
  const districts = new Map<string, { areaCd: string; signguCd: string }>();
  for (const c of scored) {
    const { lDongRegnCd, lDongSignguCd } = c.item;
    if (!lDongRegnCd || !lDongSignguCd) continue; // 카카오 후보 등 — 스킵(무감점)
    const fullSignguCd = lDongRegnCd + lDongSignguCd;
    districts.set(fullSignguCd, { areaCd: lDongRegnCd, signguCd: fullSignguCd });
  }

  if (districts.size === 0) {
    console.log(`[concentrationGate] 법정동 코드 있는 후보 없음 — 스킵`);
    return { scored, direction, matchedCount: 0, districtCount: 0 };
  }

  const nameMap = new Map<string, number>(); // 정규화 이름 → cnctrRate
  for (const { areaCd, signguCd } of districts.values()) {
    const items = await fetchDistrictConcentration(areaCd, signguCd);
    const latest = latestByName(items);
    for (const [name, item] of latest) {
      const rate = parseFloat(item.cnctrRate);
      if (!isNaN(rate)) nameMap.set(name, rate);
    }
  }

  let matchedCount = 0;
  const adjusted = scored.map((c) => {
    const rate = nameMap.get(normalizeName(c.item.title));
    if (rate === undefined) return c;
    matchedCount++;
    const ratio = Math.max(0, Math.min(1, rate / 100));
    const delta =
      direction === "quiet"
        ? -CONCENTRATION_MAX_ADJUST * ratio
        : CONCENTRATION_MAX_ADJUST * ratio;
    return {
      ...c,
      score: Math.max(0, Math.min(1, c.score + delta)),
      concentrationRate: rate,
    };
  });
  adjusted.sort((a, b) => b.score - a.score);

  console.log(
    `[concentrationGate] 방향:${direction} | 지역:${districts.size}곳 | 매칭:${matchedCount}/${scored.length}건`,
  );

  return { scored: adjusted, direction, matchedCount, districtCount: districts.size };
}
