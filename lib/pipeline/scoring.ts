import type { TourItem } from "@/lib/tour/types";
import type {
  UserProfile,
  PlaceCandidate,
  PlaceWithTags,
  TagKey,
  TravelScale,
} from "@/lib/pipeline/types";
import { SCALE_CONFIG } from "@/lib/pipeline/types";
import type { DurationRange } from "@/shared/utils/duration";
import { getKstHour } from "@/shared/utils/kst";
import { haversineKm } from "@/shared/utils/geo";
import { matchStayDurationRule } from "@/lib/pipeline/stayDuration";

const TYPE_LABEL: Record<string, string> = {
  "12": "관광지",
  "14": "문화시설",
  "15": "행사",
  "28": "레포츠",
  "38": "쇼핑",
  "39": "음식점",
};

// 점수 컴포넌트별 가중치 (합계 = 1.0)
export const SCORING_WEIGHTS = {
  tag: 0.5,
  distance: 0.25,
  time: 0.1,
  budget: 0.15,
} as const;
const W = SCORING_WEIGHTS;

// scale별 시간 예산(분) — 내부 점수 계산 전용, 사용자에게 노출하지 않는다
const TIME_BUDGET: Record<TravelScale, number> = {
  가볍게: 60,
  적당히: 120,
  여유롭게: 240,
};

// 시간 예산 적합도. 범위 중앙값이 예산 이내면 1.0, 초과분만큼 선형 감쇠(바닥 0).
// max(최악값) 기준은 범위의 부정확함을 한쪽 끝만 믿는 셈이라 중앙값을 쓴다.
export function calcBudgetFitness(
  dur: DurationRange,
  budgetMin: number,
): number {
  const mid = (dur.min + dur.max) / 2;
  return mid <= budgetMin ? 1.0 : Math.max(0, 1 - (mid - budgetMin) / budgetMin);
}

interface TagMappingRule {
  code_type: "contenttypeid" | "cat1" | "lclssystm1" | "lclssystm2" | "kakao_category";
  code_value: string;
  tag: TagKey;
  score: number;
}

// 분류 코드 → 태그 점수 매핑 규칙 (향후 DB의 tag_mapping_rules 테이블로 이전 예정)
// 같은 태그에 여러 규칙이 매칭되면 높은 점수를 채택(MAX)한다.
export const TAG_MAPPING_RULES: TagMappingRule[] = [
  // contenttypeid 기반
  { code_type: "contenttypeid", code_value: "12", tag: "도보친화", score: 1.0 }, // 관광지 — 실외
  { code_type: "contenttypeid", code_value: "12", tag: "1인여행", score: 0.5 },
  { code_type: "contenttypeid", code_value: "14", tag: "도보친화", score: 1.0 }, // 문화시설 — 실내
  { code_type: "contenttypeid", code_value: "14", tag: "조용함", score: 1.0 },
  { code_type: "contenttypeid", code_value: "14", tag: "실내", score: 1.0 },
  { code_type: "contenttypeid", code_value: "14", tag: "1인여행", score: 0.5 },
  { code_type: "contenttypeid", code_value: "28", tag: "도보친화", score: 0.5 }, // 레포츠 — 실외
  // cat1 기반 (음식점 A05는 코스에서 제외되므로 규칙 없음)
  // lclssystm1 기반
  { code_type: "lclssystm1", code_value: "NA", tag: "조용함", score: 1.0 },
  { code_type: "lclssystm1", code_value: "NA", tag: "도보친화", score: 1.0 },
  { code_type: "lclssystm1", code_value: "HS", tag: "조용함", score: 1.0 },
  { code_type: "lclssystm1", code_value: "HS", tag: "1인여행", score: 0.5 },
  { code_type: "lclssystm1", code_value: "EX", tag: "1인여행", score: 0.5 },
  // lclssystm2 기반
  { code_type: "lclssystm2", code_value: "VE07", tag: "조용함", score: 1.0 }, // 전시시설(박물관/미술관)
  { code_type: "lclssystm2", code_value: "VE07", tag: "실내", score: 1.0 },
  { code_type: "lclssystm2", code_value: "VE07", tag: "1인여행", score: 0.5 },
  { code_type: "lclssystm2", code_value: "VE03", tag: "도보친화", score: 1.0 }, // 도시공원
  { code_type: "lclssystm2", code_value: "VE03", tag: "조용함", score: 1.0 },
  { code_type: "lclssystm2", code_value: "AC05", tag: "도보친화", score: 1.0 }, // 캠핑
  { code_type: "lclssystm2", code_value: "AC05", tag: "조용함", score: 1.0 },
  // kakao_category 기반 (source=kakao 장소 전용)
  { code_type: "kakao_category", code_value: "AT4", tag: "도보친화", score: 1.0 }, // 관광명소(공원 포함)
  { code_type: "kakao_category", code_value: "AT4", tag: "조용함", score: 1.0 },
  { code_type: "kakao_category", code_value: "CT1", tag: "실내", score: 1.0 },     // 문화시설
  { code_type: "kakao_category", code_value: "CT1", tag: "조용함", score: 1.0 },
  { code_type: "kakao_category", code_value: "CT1", tag: "도보친화", score: 1.0 },
];

// 분류 코드 기반으로 장소의 태그 점수를 계산한다.
// 같은 태그에 여러 규칙이 매칭되면 높은 점수(MAX)를 채택한다.
export function applyMappingRules(item: TourItem): Record<TagKey, number> {
  const result = {} as Record<TagKey, number>;
  for (const rule of TAG_MAPPING_RULES) {
    // contenttypeid 규칙은 TourAPI 출처에만 적용한다.
    // Kakao 후보는 contenttypeid(12/14)가 버킷 편의용으로 부여됐을 뿐이므로
    // 태그 매핑에선 무시하고 kakao_category 규칙만 사용한다.
    // (timeBonus는 contenttypeid를 별도로 읽으므로 값 자체는 삭제하지 않는다)
    const isKakao = item.source === "kakao";
    const matched =
      (rule.code_type === "contenttypeid" &&
        !isKakao &&
        item.contenttypeid === rule.code_value) ||
      (rule.code_type === "cat1" && item.cat1 === rule.code_value) ||
      (rule.code_type === "lclssystm1" && item.lclsSystm1 === rule.code_value) ||
      (rule.code_type === "lclssystm2" && item.lclsSystm2 === rule.code_value) ||
      (rule.code_type === "kakao_category" &&
        item.kakaoCategory === rule.code_value);
    if (matched) {
      result[rule.tag] = Math.max(result[rule.tag] ?? 0, rule.score);
    }
  }
  return result;
}

// 태그 점수: 장소 태그 점수와 사용자 가중치의 내적값을 총 가중치 합으로 정규화.
// totalWeight 기준 정규화이므로 [0,1] 범위를 유지한다.
export function calcTagScore(
  tagScores: Record<TagKey, number>,
  weights: UserProfile["tagWeights"],
): number {
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) return 0;
  return (
    (Object.entries(tagScores) as [TagKey, number][]).reduce(
      (sum, [tag, score]) => sum + score * (weights[tag] ?? 0),
      0,
    ) / totalWeight
  );
}

// 거리 보너스: 모든 scale 공통 — 가까울수록 1.0, 반경 끝에서 0.0.
// scale은 SCALE_CONFIG의 반경(radius)만 결정하며, 점수 방향은 바뀌지 않는다.
function calcDistanceBonus(item: TourItem, profile: UserProfile): number {
  const lat = parseFloat(item.mapy);
  const lng = parseFloat(item.mapx);
  if (isNaN(lat) || isNaN(lng)) return 0;
  const maxRadiusKm = SCALE_CONFIG[profile.scale].radius / 1000;
  const distKm = haversineKm(
    profile.location.mapY,
    profile.location.mapX,
    lat,
    lng,
  );
  const ratio = Math.min(1, distKm / maxRadiusKm);
  return Math.max(0, 1 - ratio); // 모든 scale: 가까울수록 1.0
}

// 시간대 보너스: 현재 시각에 어울리는 콘텐츠 타입에 가중치를 부여한다.
// 반환값 범위: [0, 1.0]
// (음식점 type=39 분기는 음식점이 후보 수집 단계(2번)에서 이미 제외되어 도달 불가능한
// 코드였으므로 제거했다 — 2026-06-28)
function calcTimeBonus(item: TourItem): number {
  const hour = getKstHour();
  const type = item.contenttypeid;

  if ((hour >= 9 && hour < 11) || (hour >= 13 && hour < 17)) {
    if (type === "12" || type === "14") return 1.0;
  }
  if (hour >= 9 && hour < 12) {
    if (type === "28") return 1.0;
  }
  return 0;
}

// [stage4] stage2/stage3를 통과한 일반 장소에 점수를 부여하고 내림차순으로 정렬한다.
//
// 최종 점수 = W.tag × tagScore + W.distance × distanceBonus + W.time × timeBonus + W.budget × budgetFitness
//           = 0.5 × [0,1] + 0.25 × [0,1] + 0.1 × [0,1] + 0.15 × [0,1]
//           → 범위: [0, 1.0]
export async function scoreCandidates(
  items: PlaceWithTags[],
  profile: UserProfile,
): Promise<PlaceCandidate[]> {
  const t0 = Date.now();

  const totalWeight = Object.values(profile.tagWeights).reduce(
    (s, w) => s + w,
    0,
  );
  console.log(`[stage4] ${items.length}건 점수화 시작`);
  console.log(
    `[stage4] 사용자 태그 가중치: ${JSON.stringify(profile.tagWeights)} (총합 ${totalWeight})`,
  );
  console.log(
    `[stage4] 컴포넌트 가중치: 태그×${W.tag} + 거리×${W.distance} + 시간×${W.time} + 예산×${W.budget}`,
  );

  const scored = items.map((item, i) => {
    const idx = `[${i + 1}/${items.length}]`;
    const tagScores = item.tagScores;
    const tagScore = calcTagScore(tagScores, profile.tagWeights);
    const distanceBonus = calcDistanceBonus(item, profile);
    const timeBonus = calcTimeBonus(item);
    const budget = TIME_BUDGET[profile.scale];
    const { key: stayDurationKey, range: dur } = matchStayDurationRule({
      lclsSystm1: item.lclsSystm1,
      lclsSystm2: item.lclsSystm2,
      lclsSystm3: item.lclsSystm3,
      source: item.source,
      kakaoCategory: item.kakaoCategory,
    });
    const budgetFitness = calcBudgetFitness(dur, budget);
    const score =
      W.tag * tagScore +
      W.distance * distanceBonus +
      W.time * timeBonus +
      W.budget * budgetFitness;

    const tagLabel = Object.entries(tagScores)
      .filter(([, s]) => s > 0)
      .map(([t, s]) => `${t}:${s}`)
      .join(",");
    const timeSuffix =
      timeBonus < 0 ? `${timeBonus.toFixed(2)}` : `+${timeBonus.toFixed(2)}`;
    console.log(
      `[stage4] ${idx} "${item.title}" (${TYPE_LABEL[item.contenttypeid] ?? item.contenttypeid}) (${item.source === "kakao" ? "카카오" : "관광공사"})` +
        ` lcs:${item.lclsSystm1 ?? "-"}/${item.lclsSystm2 ?? "-"}/${item.lclsSystm3 ?? "-"} dur:${dur.min}~${dur.max}min` +
        ` 태그:[${tagLabel}] 태그:${tagScore.toFixed(2)} 거리:+${distanceBonus.toFixed(2)} 시간:${timeSuffix} 예산:+${budgetFitness.toFixed(2)} → 최종:${score.toFixed(3)}`,
    );

    const tags = (Object.entries(tagScores) as [TagKey, number][])
      .filter(([, s]) => s > 0)
      .map(([t]) => t);
    return { item, tagScores, tags, score, available: true, availabilityUncertain: item.availabilityUncertain ?? false, estimatedDuration: dur, stayDurationKey, hours: item.hours, restDayNote: item.restDayNote };
  });

  scored.sort((a, b) => b.score - a.score);
  console.log(
    `[stage4] 완료 — 상위 3: ${scored
      .slice(0, 3)
      .map((c) => `"${c.item.title}"(${c.score.toFixed(3)})`)
      .join(", ")} (총 ${Date.now() - t0}ms)`,
  );
  return scored;
}
