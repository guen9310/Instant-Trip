import type { TourItem } from "@/lib/tour/types";
import type {
  UserProfile,
  PlaceCandidate,
  PlaceWithTags,
  TagKey,
} from "@/lib/pipeline/types";
import { SCALE_CONFIG } from "@/lib/pipeline/types";

const TYPE_LABEL: Record<string, string> = {
  "12": "관광지",
  "14": "문화시설",
  "15": "행사",
  "28": "레포츠",
  "38": "쇼핑",
  "39": "음식점",
};

// 점수 컴포넌트별 가중치 (합계 = 1.0)
export const SCORING_WEIGHTS = { tag: 0.6, distance: 0.3, time: 0.1 } as const;
const W = SCORING_WEIGHTS;

interface TagMappingRule {
  code_type: "contenttypeid" | "cat1" | "lclssystm1";
  code_value: string;
  tag: TagKey;
  score: number;
}

// 분류 코드 → 태그 점수 매핑 규칙 (향후 DB의 tag_mapping_rules 테이블로 이전 예정)
// 같은 태그에 여러 규칙이 매칭되면 높은 점수를 채택(MAX)한다.
export const TAG_MAPPING_RULES: TagMappingRule[] = [
  // contenttypeid 기반
  { code_type: "contenttypeid", code_value: "12", tag: "도보친화", score: 1.0 },  // 관광지 — 실외
  { code_type: "contenttypeid", code_value: "12", tag: "1인여행", score: 0.5 },
  { code_type: "contenttypeid", code_value: "14", tag: "도보친화", score: 1.0 },  // 문화시설 — 실내
  { code_type: "contenttypeid", code_value: "14", tag: "조용함",   score: 1.0 },
  { code_type: "contenttypeid", code_value: "14", tag: "실내",     score: 1.0 },
  { code_type: "contenttypeid", code_value: "14", tag: "1인여행",  score: 0.5 },
  { code_type: "contenttypeid", code_value: "28", tag: "도보친화", score: 0.5 },  // 레포츠 — 실외
  { code_type: "contenttypeid", code_value: "38", tag: "실내",     score: 1.0 },  // 쇼핑 — 실내
  // cat1 기반 (음식점 A05는 코스에서 제외되므로 규칙 없음)
  // lclssystm1 기반
  { code_type: "lclssystm1", code_value: "NA", tag: "조용함",   score: 1.0 },
  { code_type: "lclssystm1", code_value: "NA", tag: "도보친화", score: 1.0 },
  { code_type: "lclssystm1", code_value: "HS", tag: "조용함",   score: 1.0 },
  { code_type: "lclssystm1", code_value: "HS", tag: "1인여행",  score: 0.5 },
];

// 분류 코드 기반으로 장소의 태그 점수를 계산한다.
// 같은 태그에 여러 규칙이 매칭되면 높은 점수(MAX)를 채택한다.
export function applyMappingRules(item: TourItem): Record<TagKey, number> {
  const result = {} as Record<TagKey, number>;
  for (const rule of TAG_MAPPING_RULES) {
    const matched =
      (rule.code_type === "contenttypeid" &&
        item.contenttypeid === rule.code_value) ||
      (rule.code_type === "cat1" && item.cat1 === rule.code_value) ||
      (rule.code_type === "lclssystm1" && item.lclsSystm1 === rule.code_value);
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

// 두 좌표 사이의 거리를 킬로미터로 계산한다 (Haversine 공식).
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 거리 보너스: 사용자 위치에서 가까울수록 높은 점수를 부여한다.
// 반경 내 가장 가까운 곳(거리=0) → 1.0, 반경 끝(거리=반경) → 0.0
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
  return Math.max(0, 1 - distKm / maxRadiusKm);
}

// 시간대 보너스: 현재 시각에 어울리는 콘텐츠 타입에 가중치를 부여한다.
// 반환값 범위: [-1.0, 1.0]
function calcTimeBonus(item: TourItem): number {
  const hour = new Date().getHours();
  const type = item.contenttypeid;

  if (type === "39") {
    return (hour >= 11 && hour <= 13) || (hour >= 17 && hour <= 20)
      ? 1.0
      : -0.5;
  }
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
// 최종 점수 = W.tag × tagScore + W.distance × distanceBonus + W.time × timeBonus
//           = 0.6 × [0,1] + 0.3 × [0,1] + 0.1 × [-0.5,1.0]
//           → 범위: [-0.05, 1.0]
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
    `[stage4] 컴포넌트 가중치: 태그×${W.tag} + 거리×${W.distance} + 시간×${W.time}`,
  );

  const scored = items.map((item, i) => {
    const idx = `[${i + 1}/${items.length}]`;
    const tagScores = item.tagScores;
    const tagScore = calcTagScore(tagScores, profile.tagWeights);
    const distanceBonus = calcDistanceBonus(item, profile);
    const timeBonus = calcTimeBonus(item);
    const score =
      W.tag * tagScore + W.distance * distanceBonus + W.time * timeBonus;

    const tagLabel = Object.entries(tagScores)
      .filter(([, s]) => s > 0)
      .map(([t, s]) => `${t}:${s}`)
      .join(",");
    const timeSuffix =
      timeBonus < 0 ? `${timeBonus.toFixed(2)}` : `+${timeBonus.toFixed(2)}`;
    console.log(
      `[stage4] ${idx} "${item.title}" (${TYPE_LABEL[item.contenttypeid] ?? item.contenttypeid})` +
        ` 태그:[${tagLabel}] 태그:${tagScore.toFixed(2)} 거리:+${distanceBonus.toFixed(2)} 시간:${timeSuffix} → 최종:${score.toFixed(3)}`,
    );

    const tags = (Object.entries(tagScores) as [TagKey, number][])
      .filter(([, s]) => s > 0)
      .map(([t]) => t);
    return { item, tagScores, tags, score, available: true };
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
