import type { UserProfile, TravelScale } from "@/lib/pipeline/types";
import type { CourseResult } from "@/lib/pipeline/types";
import type { JourneyPlace, BadgeVariant } from "@/shared/types/course.types";

type EnglishScale = "light" | "moderate" | "leisurely";

const SCALE_MAP: Record<EnglishScale, TravelScale> = {
  light:     "가볍게",
  moderate:  "적당히",
  leisurely: "여유롭게",
};

const CAT_LABEL: Record<string, string> = {
  "12": "관광지",
  "14": "문화시설",
  "28": "레포츠",
};

const TAG_BADGE: Record<string, { text: string; variant: BadgeVariant }> = {
  도보친화: { text: "도보친화", variant: "accent" },
  "1인여행": { text: "1인여행", variant: "secondary" },
  실내:     { text: "실내",    variant: "secondary" },
  조용함:   { text: "조용함",  variant: "outline" },
};

export interface UserPrefs {
  travel: string;
  party: string;
  vibe: string;
  food: string;
  indoor: string;
}

export function prefsToProfile(
  prefs: UserPrefs,
  location: { mapX: number; mapY: number },
  scale: EnglishScale,
): UserProfile {
  return {
    tagWeights: {
      도보친화: prefs.travel === "walk"   ? 1 : 0,
      "1인여행": prefs.party  === "solo"   ? 1 : 0,
      실내:     prefs.indoor === "indoor" ? 1 : 0,
      조용함:   prefs.vibe   === "quiet"  ? 1 : 0,
    },
    preferFood: prefs.food === "matjip",
    festivalAffinity: prefs.indoor === "indoor" ? 0 : 0.6,
    location,
    scale: SCALE_MAP[scale],
    areaCode: "",
    sigunguCode: "",
  };
}

export function courseResultToJourneyPlaces(result: CourseResult): JourneyPlace[] {
  const places: JourneyPlace[] = [];

  if (result.mainPlace) {
    const p = result.mainPlace;
    const cat = CAT_LABEL[p.contentTypeId] ?? "장소";
    const firstTag = p.tags[0];
    const badge = firstTag
      ? (TAG_BADGE[firstTag] ?? { text: cat, variant: "secondary" as BadgeVariant })
      : { text: cat, variant: "secondary" as BadgeVariant };

    places.push({
      id:       p.contentId,
      cat,
      name:     p.title,
      addr:     p.address,
      hours:    "",
      time:     "",
      dur:      `보통 ${p.estimatedDurationMin}분 정도`,
      travel:   "",
      badge,
      desc:     p.overview,
      coord:    p.coord,
      imageUrl: p.images?.[0] ?? null,
      availabilityUncertain: p.availabilityUncertain,
      estimatedDurationMin: p.estimatedDurationMin,
    });
  }

  for (const p of result.nearbyPlaces) {
    const cat = CAT_LABEL[p.contentTypeId] ?? "장소";
    const firstTag = p.tags[0];
    const badge = firstTag
      ? (TAG_BADGE[firstTag] ?? { text: cat, variant: "secondary" as BadgeVariant })
      : { text: cat, variant: "secondary" as BadgeVariant };

    places.push({
      id:       p.contentId,
      cat,
      name:     p.title,
      addr:     p.address,
      hours:    "",
      time:     "",
      dur:      `보통 ${p.estimatedDurationMin}분 정도`,
      travel:   "도보 이동",
      badge,
      desc:     p.overview,
      coord:    p.coord,
      imageUrl: p.images?.[0] ?? null,
      availabilityUncertain: p.availabilityUncertain,
      estimatedDurationMin: p.estimatedDurationMin,
    });
  }

  return places;
}
