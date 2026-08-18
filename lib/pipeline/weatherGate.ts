import type { PlaceCandidate } from "@/lib/pipeline/types";
import { classifyIndoorOutdoor } from "@/lib/pipeline/indoorOutdoor";
import type { WeatherCondition, WeatherGateSignal } from "@/shared/utils/weatherContext";

export type WeatherGateReason = "rain" | "snow" | "heatwave";

// "방문 예상 시간대" = 코스 생성 시점. 이 파이프라인은 "지금 당장 가는 단일 장소"만
// 만들어(nearbyPlaces는 항상 [], JourneyPlace.time은 항상 "") 방문 시각을 별도로
// 계산하지 않는다 — now~now+WEATHER_GATE_WINDOW_HOURS 안의 최악 날씨를 근사치로
// 쓴다. "여유롭게"(240분 체류)는 이 창을 벗어나는 날씨를 놓칠 수 있다 — scale별
// 창 확장은 후속 과제로 남긴다.
export const WEATHER_GATE_WINDOW_HOURS = 2;

// 감점 계수 — [0,1] 점수 스케일 기준. scoring.ts의 SCORING_WEIGHTS.distance(0.25)를
// 상한 기준선으로 삼았다: "실내선호해요"만 체크한 사용자의 태그 컴포넌트 최대
// 기여분(W.tag×1=0.5)에 근접한 감점은 사실상 하드 배제나 다름없어 "실외가 압도적
// 으로 좋으면 그대로 채택한다"는 소프트 감점 취지를 깬다. 조건별로 차등을 둔다:
// 적설은 통행·낙상 위험이 강수보다 커서 더 무겁게, 폭염은 "접근 불가"가 아닌
// "불쾌"라 가장 약하게.
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

// weatherOverride(테스트·데모 전용)를 실제 API 호출 없이 WeatherGateSignal로 변환한다.
export function overrideToSignal(
  override: WeatherCondition | "heatwave",
): WeatherGateSignal {
  if (override === "heatwave") {
    return { condition: "clear", isHeatwave: true, tempC: 33, hoursAhead: 0 };
  }
  return { condition: override, isHeatwave: false, tempC: null, hoursAhead: 0 };
}
