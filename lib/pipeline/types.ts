import type { TourItem } from "@/lib/tour/types";
import type { CulturalFestival } from "@/lib/clients/cultural-festival";

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
  festivalAffinity: number;   // 0.0 ~ 1.0, 온보딩에서 파생 — 축제 섹션 정렬에만 사용
  location: { mapX: number; mapY: number };
  scale: TravelScale;
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
    festivalAffinity: (answers.실내선호해요 ? 0 : 0.6) + (answers.조용한곳좋아요 ? 0 : 0.4),
    location,
    scale,
    areaCode,
    sigunguCode,
  };
}

// 코스 완료 후 별점 피드백으로 태그 가중치 보정
export function applyFeedback(
  profile: UserProfile,
  tags: TagKey[],
  rating: number,
): UserProfile {
  const delta = rating >= 4 ? 0.5 : rating <= 2 ? -0.5 : 0;
  if (delta === 0) return profile;

  const updated = { ...profile.tagWeights };
  for (const tag of tags) {
    updated[tag] = Math.max(0, (updated[tag] ?? 0) + delta);
  }
  return { ...profile, tagWeights: updated };
}

// 여행 규모별 설정 — radius: 수집 반경(m)
export const SCALE_CONFIG: Record<TravelScale, { radius: number }> = {
  가볍게:   { radius: 5000 },
  적당히:   { radius: 10000 },
  여유롭게: { radius: 20000 },
};

// DB에서 조회한 장소 (tag_scores 사전 계산 포함)
export type PlaceWithTags = TourItem & { tagScores: Record<TagKey, number>; availabilityUncertain?: boolean };

export interface PlaceCandidate {
  item: TourItem;
  tagScores: Record<TagKey, number>;
  tags: TagKey[];
  score: number;
  available: boolean;
  availabilityUncertain: boolean;
  estimatedDurationMin: number;
}

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
  estimatedDurationMin: number;
}

// Kakao 로컬 API에서 가져온 식당 요약 — preferFood=true일 때만 채워짐
export interface RecommendedFood {
  name: string;
  category: string;    // 카테고리명 (예: "한식 > 해물,생선요리")
  address: string;
  phone: string;
  distanceM: number;
  url: string;
  coord: { lat: number; lng: number };
}

export interface CourseResult {
  mainPlace: CoursePlace | null;
  nearbyPlaces: CoursePlace[];
  festivals: { ongoing: CulturalFestival[]; upcoming: CulturalFestival[] };
  recommended_food: RecommendedFood | null;
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
