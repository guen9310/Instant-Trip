import type { TourItem } from "@/lib/tour/types";
import type { CulturalFestival } from "@/lib/clients/culturalFestival";
import type { DurationRange } from "@/shared/utils/duration";
import type {
  FestivalProgramInfo,
  FestivalPhase,
  WeatherSwitchReason,
  ConcentrationSwitchReason,
} from "@/shared/types/course.types";
import type { TagKey, TagWeights } from "@/shared/constants/preferences";

export type { TagKey, TagWeights };

export type TravelScale = "가볍게" | "적당히" | "여유롭게";

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
export type PlaceWithTags = TourItem & {
  tagScores: Record<TagKey, number>;
  availabilityUncertain?: boolean;
  hours?: string | null;
  restDayNote?: string | null;
};

export interface PlaceCandidate {
  item: TourItem;
  tagScores: Record<TagKey, number>;
  tags: TagKey[];
  // 사용자가 선택한(tagWeights>0) 태그 중 이 장소의 tagScores가 가장 높은 것.
  // 온보딩 4문항이 전부 "반대쪽"이라 선택된 태그가 하나도 없으면 null — 직접
  // 선택 진입(selectPlace/selectFestival)도 온보딩 매칭 개념이 없어 null.
  topPreferenceTag: TagKey | null;
  score: number;
  available: boolean;
  availabilityUncertain: boolean;
  estimatedDuration: DurationRange;
  // detailIntro2 usetime/restdate 원문 — CoursePlace.hours 합성 입력.
  // 배치 필터(filterByAvailability) 경로에서만 채워진다.
  hours?: string | null;
  restDayNote?: string | null;
  // 관광지 집중률(TatsCnctrRateService) 매칭 값(0~100) — concentrationGate.ts가 이름
  // 매칭에 성공한 후보에만 채운다. CONCENTRATION_GATE_ENABLED가 꺼져 있거나 매칭
  // 안 되면 undefined — index.ts가 이 값의 유무로 배너 노출 여부를 판단한다.
  concentrationRate?: number | null;
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
  topPreferenceTag: TagKey | null;
  score: number;
  availabilityUncertain: boolean;
  estimatedDuration: DurationRange;
  origin: PlaceOrigin;
  // usetime/restdate 원문을 합성한 표시용 문자열. 데이터 없으면 "".
  hours: string;
  // 카카오 로컬 출처(item.source === "kakao")일 때만 채워지는 카카오 장소 상세 페이지 URL.
  // TourAPI 출처는 카카오 장소 ID가 없어 undefined.
  placeUrl?: string;
  // 축제 + Tour API 매칭된 경우에만 채워진다(lib/pipeline/selectFestival.ts).
  programInfo?: FestivalProgramInfo | null;
  organizerUrl?: string | null;
  festivalPhase?: FestivalPhase;
  festivalStartLabel?: string;
}

export interface CourseResult {
  mainPlace: CoursePlace | null;
  nearbyPlaces: CoursePlace[];
  festivals: { ongoing: CulturalFestival[]; upcoming: CulturalFestival[] };
  scale: TravelScale;
  generatedAt: string;
  // optional인 이유: 날씨 판정은 오케스트레이터(lib/pipeline/index.ts)만 알아야 하는
  // 개념이라, required로 두면 course.ts(assembleCourse)·selectPlace.ts/selectFestival.ts의
  // CourseResult 생성 지점을 전부 건드려야 한다. availability?(PlaceAvailabilitySnapshot)와
  // 동일한 패턴.
  weatherSwitch?: WeatherSwitchReason | null;
  // weatherSwitch와 같은 이유로 optional — CONCENTRATION_GATE_ENABLED일 때만 채워진다.
  concentrationSwitch?: ConcentrationSwitchReason | null;
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
