import type { UserProfile, TravelScale } from "@/lib/pipeline/types";
import type { CourseResult, CoursePlace } from "@/lib/pipeline/types";
import type { CulturalFestival } from "@/lib/clients/cultural-festival";
import type {
  JourneyPlace,
  BadgeVariant,
  FestivalSummary,
} from "@/shared/types/course.types";
import { formatDuration } from "@/shared/utils/duration";

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
    // 실외 선호(0.6) + 활기참 선호(0.4) 합산 — 둘 다면 1.0, 둘 다 아니면 0
    festivalAffinity:
      (prefs.indoor === "outdoor" ? 0.6 : 0) +
      (prefs.vibe === "lively" ? 0.4 : 0),
    location,
    scale: SCALE_MAP[scale],
    areaCode: "",
    sigunguCode: "",
  };
}

export function coursePlaceToJourneyPlace(p: CoursePlace): JourneyPlace {
  const cat = CAT_LABEL[p.contentTypeId] ?? "장소";
  const firstTag = p.tags[0];
  const badge = firstTag
    ? (TAG_BADGE[firstTag] ?? { text: cat, variant: "secondary" as BadgeVariant })
    : { text: cat, variant: "secondary" as BadgeVariant };

  return {
    id:       p.contentId,
    cat,
    name:     p.title,
    addr:     p.address,
    hours:    "",
    time:     "",
    dur:      formatDuration(p.estimatedDuration),
    badge,
    desc:     p.overview,
    coord:    p.coord,
    imageUrl: p.images?.[0] ?? null,
    availabilityUncertain: p.availabilityUncertain,
    estimatedDuration: p.estimatedDuration,
    stayDurationKey: p.stayDurationKey,
    tags: p.tags,
  };
}

// 공공데이터포털 응답은 "YYYY-MM-DD"(대시 포함, 2026-06-29 확인) 형식이다.
// 혹시 대시 없는 "YYYYMMDD"가 오는 경우도 방어적으로 처리한다.
function formatFestivalDate(dateStr: string): string {
  const dashed = dateStr.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (dashed) return `${dashed[1]}.${dashed[2]}`;
  if (dateStr.length === 8) return `${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
  return dateStr;
}

function toFestivalSummary(
  f: CulturalFestival,
  status: "ongoing" | "upcoming",
): FestivalSummary {
  return {
    id: `${f.fstvlStartDate}_${f.fstvlNm}`,
    name: f.fstvlNm,
    status,
    period: `${formatFestivalDate(f.fstvlStartDate)} ~ ${formatFestivalDate(f.fstvlEndDate)}`,
    address: f.rdnmadr || f.lnmadr || "",
    imageUrl: (f as CulturalFestival & { images?: string[] }).images?.[0] ?? null,
  };
}

// CulturalFestival → 화면 표시용 FestivalSummary. festivals.ongoing[0]에는
// pipeline/index.ts가 미리 로드한 images가 덮어써져 있을 수 있다(있으면 사용).
export function courseResultToFestivalSummaries(
  result: CourseResult,
): FestivalSummary[] {
  // upcoming은 코스 결과 화면에 표시하지 않는다 — "지금 갈 곳"을 결정하는 맥락에서
  // 예정 축제는 즉시 활용 불가한 정보라 혼란만 준다. 피드 기능에서 별도 활용 예정.
  return result.festivals.ongoing.map((f) => toFestivalSummary(f, "ongoing"));
}

// 홈 화면용 — ongoing + upcoming 모두 변환
export function festivalsToSummaries(festivals: {
  ongoing: CulturalFestival[];
  upcoming: CulturalFestival[];
}): { ongoing: FestivalSummary[]; upcoming: FestivalSummary[] } {
  return {
    ongoing: festivals.ongoing.map((f) => toFestivalSummary(f, "ongoing")),
    upcoming: festivals.upcoming.map((f) => toFestivalSummary(f, "upcoming")),
  };
}

