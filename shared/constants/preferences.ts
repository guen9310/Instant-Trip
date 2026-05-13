import {
  Footprints,
  Navigation,
  User,
  Users,
  Volume1,
  Zap,
  UtensilsCrossed,
  Minus,
  MapPin,
  Map,
  type LucideIcon,
} from "lucide-react";

export type PrefKey = "travel" | "party" | "vibe" | "food" | "radius";

export type Prefs = {
  travel: "walk" | "min";
  party: "solo" | "group";
  vibe: "quiet" | "lively";
  food: "matjip" | "any";
  radius: "near" | "far";
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
  radius: {
    label: "이동 반경",
    options: [
      { id: "near", icon: MapPin },
      { id: "far", icon: Map },
    ],
  },
};

export const PREF_KEYS: PrefKey[] = ["travel", "party", "vibe", "food", "radius"];

export const DEFAULT_PREFS: Prefs = {
  travel: "walk",
  party: "solo",
  vibe: "quiet",
  food: "matjip",
  radius: "near",
};
