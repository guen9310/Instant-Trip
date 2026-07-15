import type { TourItem } from "@/lib/tour/types";
import type { CulturalFestival } from "@/lib/clients/cultural-festival";
import type { DurationRange } from "@/shared/utils/duration";

export type TravelScale = "가볍게" | "적당히" | "여유롭게";

export type TagKey = "도보친화" | "1인여행" | "실내" | "조용함";

export type TagWeights = Record<TagKey, number>;

export interface OnboardingAnswers {
  걷는거좋아요: boolean;
  혼자여행해요: boolean;
  실내선호해요: boolean;
  먹는게중요해요: boolean;
  조용한곳좋아요: boolean;
}

export interface UserProfile {
  tagWeights: TagWeights;
  preferFood: boolean;        // 맛집 선호 — 코스 이후 Kakao 식당 1곳 추천에 사용
  location: { mapX: number; mapY: number };
  scale: TravelScale;
  // 검색 반경(m) 오버라이드 — 미지정 시 규모별 기본값(SCALE_CONFIG) 사용.
  // NoNearbyView의 "반경 넓혀서 다시 찾기" 재시도에서 설정된다.
  radiusOverrideM?: number;
  // KorService2 지역 코드
  areaCode: string;
  sigunguCode: string;
}

export function onboardingToProfile(
  answers: OnboardingAnswers,
  location: { mapX: number; mapY: number },
  scale: TravelScale,
  areaCode: string,
  sigunguCode: string,
): UserProfile {
  return {
    tagWeights: {
      도보친화: answers.걷는거좋아요 ? 1 : 0,
      "1인여행": answers.혼자여행해요 ? 1 : 0,
      실내: answers.실내선호해요 ? 1 : 0,
      조용함: answers.조용한곳좋아요 ? 1 : 0,
    },
    preferFood: answers.먹는게중요해요,
    location,
    scale,
    areaCode,
    sigunguCode,
  };
}

// 여행 규모별 설정 — radius: 수집 반경(m)
export const SCALE_CONFIG: Record<TravelScale, { radius: number }> = {
  가볍게:   { radius: 5000 },
  적당히:   { radius: 10000 },
  여유롭게: { radius: 20000 },
};

// 실제 사용할 검색 반경(m) — 반경 확장 재시도(radiusOverrideM)가 규모별 기본값보다 우선
export function getSearchRadiusM(profile: UserProfile): number {
  return profile.radiusOverrideM ?? SCALE_CONFIG[profile.scale].radius;
}

// DB에서 조회한 장소 (tag_scores 사전 계산 포함)
export type PlaceWithTags = TourItem & { tagScores: Record<TagKey, number>; availabilityUncertain?: boolean };

export interface PlaceCandidate {
  item: TourItem;
  tagScores: Record<TagKey, number>;
  tags: TagKey[];
  score: number;
  available: boolean;
  availabilityUncertain: boolean;
  estimatedDuration: DurationRange;
  // 매칭된 체류시간 규칙의 key — 완료 기록에 저장되어 실측 집계의 조인 키가 된다
  stayDurationKey: string;
}

// 이 장소가 어떻게 코스에 들어왔는지 — 취향 기반 추천(stage4 점수화) vs
// 홈 근처 카드에서 사용자가 직접 선택. score는 "recommended"에서만 의미가 있다.
export type PlaceOrigin = "recommended" | "selected";

export interface CoursePlace {
  contentId: string;
  contentTypeId: string;
  title: string;
  address: string;
  shortAddress: string;
  overview: string;
  images: string[];
  coord: { lat: number; lng: number } | null;
  tags: TagKey[];
  score: number;
  availabilityUncertain: boolean;
  estimatedDuration: DurationRange;
  stayDurationKey: string;
  origin: PlaceOrigin;
}

export interface CourseResult {
  mainPlace: CoursePlace | null;
  nearbyPlaces: CoursePlace[];
  festivals: { ongoing: CulturalFestival[]; upcoming: CulturalFestival[] };
  scale: TravelScale;
  generatedAt: string;
}

// 파이프라인 전체 결과 (디버그 포함)
export interface PipelineResult {
  course: CourseResult;
  debug: {
    collected: TourItem[];
    available: TourItem[];
    scored: Array<PlaceCandidate & { inCourse: boolean }>;
  };
}
