import type { PlaceCandidate } from "@/lib/pipeline/types";
import { classifyIndoorOutdoor } from "@/lib/pipeline/indoorOutdoor";
import type { WeatherCondition, WeatherGateSignal } from "@/shared/utils/weatherContext";

export type WeatherGateReason = "rain" | "snow" | "heatwave";

// 코스 생성 시점 기준 now~+2시간의 최악 날씨를 "방문 시점 날씨"로 근사한다
// (방문 예상 시간대 자체를 계산하지 않는 파이프라인이라).
export const WEATHER_GATE_WINDOW_HOURS = 2;

// scoring.ts의 SCORING_WEIGHTS.distance(0.25)보다 작게 잡은 소프트 감점 —
// 실외가 다른 신호로 압도적이면 그대로 채택되게 하기 위함. snow>rain>heatwave
// 순서는 체감 위험도 순.
export const WEATHER_PENALTY: Record<WeatherGateReason, number> = {
  rain: 0.15,
  snow: 0.20,
  heatwave: 0.10,
};

export type WeatherGateResult = {
  scored: PlaceCandidate[]; // 재정렬된 새 배열 — 원본 배열은 변경하지 않는다
  reason: WeatherGateReason | null;
  penalizedCount: number;
};

function resolveReason(signal: WeatherGateSignal): WeatherGateReason | null {
  if (signal.condition === "snow") return "snow";
  if (signal.condition === "rain") return "rain";
  if (signal.isHeatwave) return "heatwave";
  return null;
}

// stage4(점수화) 직후 · 가용성 게이트 이전에 호출한다. scoring.ts는 날씨를 전혀
// 모르는 순수 함수로 유지하고, 날씨 지식은 이 파일에만 존재한다.
export function applyWeatherGate(
  scored: PlaceCandidate[],
  signal: WeatherGateSignal,
): WeatherGateResult {
  const reason = resolveReason(signal);
  if (!reason) return { scored, reason: null, penalizedCount: 0 };

  const penalty = WEATHER_PENALTY[reason];
  let penalizedCount = 0;
  const adjusted = scored.map((c) => {
    if (classifyIndoorOutdoor(c.item) !== "outdoor") return c;
    penalizedCount++;
    return { ...c, score: Math.max(0, c.score - penalty) };
  });
  adjusted.sort((a, b) => b.score - a.score);

  return { scored: adjusted, reason, penalizedCount };
}

// 감점 전엔 winner보다 위였는데 감점으로 아래로 밀린 실외 후보를 찾는다(없으면
// null) — "날씨 때문에 이 실내 장소가 채택됐는지"의 근거. 그 후보가 실제로
// 열려 있었는지는 확인하지 않는다(가용성 게이트 재순회=추가 API 호출을 피하기
// 위한 트레이드오프, 상세는 docs/plan/weather-adaptive-recommendation.md §5-1).
export function findDemotedOutdoorCandidate(
  preScored: PlaceCandidate[],
  postScored: PlaceCandidate[],
  winner: PlaceCandidate,
): PlaceCandidate | null {
  const postPositionByContentId = new Map(
    postScored.map((c, i) => [c.item.contentid, i]),
  );
  const winnerPostPos = postPositionByContentId.get(winner.item.contentid) ?? -1;

  for (const candidate of preScored) {
    if (candidate.item.contentid === winner.item.contentid) break; // winner 이전까지만 훑는다
    if (classifyIndoorOutdoor(candidate.item) !== "outdoor") continue;
    const postPos = postPositionByContentId.get(candidate.item.contentid) ?? -1;
    if (postPos > winnerPostPos) return candidate; // 감점으로 winner보다 아래로 밀려남
  }
  return null;
}

// weatherOverride(테스트·데모 전용)를 실제 API 호출 없이 WeatherGateSignal로 변환한다.
export function overrideToSignal(
  override: WeatherCondition | "heatwave",
): WeatherGateSignal {
  if (override === "heatwave") {
    return { condition: "clear", isHeatwave: true, tempC: 33, hoursAhead: 0 };
  }
  return { condition: override, isHeatwave: false, tempC: null, hoursAhead: 0 };
}
