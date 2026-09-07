import {
  Footprints,
  Navigation,
  User,
  Users,
  Volume1,
  Zap,
  UtensilsCrossed,
  Minus,
  Building2,
  TreePine,
  type LucideIcon,
} from "lucide-react";

export type PrefKey = "travel" | "party" | "vibe" | "food" | "indoor";

// 온보딩 답변이 매핑되는 추천 점수 태그. lib/pipeline/scoring.ts(장소 분류 코드 →
// 태그 점수)와 lib/tour/mappers.ts(온보딩 답변 → 태그 가중치) 양쪽이 공유하는
// 어휘라 shared에 둔다 — lib는 shared를 import할 수 있지만 반대는 불가능하므로.
export type TagKey = "도보친화" | "1인여행" | "실내" | "조용함";

export type TagWeights = Record<TagKey, number>;

export type Prefs = {
  travel: "walk" | "min";
  party: "solo" | "group";
  vibe: "quiet" | "lively";
  food: "matjip" | "any";
  indoor: "indoor" | "outdoor";
};

export type PrefOption = { id: string; icon: LucideIcon };

export const PREF_META: Record<PrefKey, { label: string; options: PrefOption[] }> = {
  travel: {
    label: "이동 방식",
    options: [
      { id: "walk", icon: Footprints },
      { id: "min", icon: Navigation },
    ],
  },
  party: {
    label: "여행 인원",
    options: [
      { id: "solo", icon: User },
      { id: "group", icon: Users },
    ],
  },
  vibe: {
    label: "장소 분위기",
    options: [
      { id: "quiet", icon: Volume1 },
      { id: "lively", icon: Zap },
    ],
  },
  food: {
    label: "먹거리",
    options: [
      { id: "matjip", icon: UtensilsCrossed },
      { id: "any", icon: Minus },
    ],
  },
  indoor: {
    label: "장소 유형",
    options: [
      { id: "indoor", icon: Building2 },
      { id: "outdoor", icon: TreePine },
    ],
  },
};

export const PREF_KEYS: PrefKey[] = ["travel", "party", "vibe", "food", "indoor"];

export const DEFAULT_PREFS: Prefs = {
  travel: "walk",
  party: "solo",
  vibe: "quiet",
  food: "matjip",
  indoor: "indoor",
};
