import type { DurationRange } from "@/shared/utils/duration";

export type BadgeVariant = "accent" | "secondary" | "point" | "outline";

// 추천된 장소 1곳의 상세 데이터 (프리뷰/진행 화면에서 사용)
export type JourneyPlace = {
  id: string;
  cat: string;
  name: string;
  addr: string;
  hours: string;
  time: string;
  dur: string;
  badge: { text: string; variant: BadgeVariant };
  desc: string;
  coord: { lat: number; lng: number } | null;
  imageUrl: string | null;
  availabilityUncertain: boolean;
  estimatedDuration: DurationRange;
  // 매칭된 체류시간 규칙 key — 완료 기록의 실측 집계 조인 키 (구버전 localStorage엔 없을 수 있음)
  stayDurationKey?: string;
  tags: string[];
};

// 코스 결과의 보조 정보 — 진행중/예정 축제 (product-plan.md 4번 "부가" 참조)
export type FestivalSummary = {
  id: string;
  name: string;
  status: "ongoing" | "upcoming";
  period: string;
  address: string;
  imageUrl: string | null;
};


export type NearbyCategory = "all" | "cafe" | "convenience" | "pharmacy" | "restaurant" | "parking" | "gas_station";

export type NearbyPoi = {
  id: string;
  category: Exclude<NearbyCategory, "all">;
  name: string;
  dist: string;
  isOpen: boolean;
  coord: { lat: number; lng: number };
  placeUrl: string;
};

// localStorage "pendingCourse" — 생성된 추천을 프리뷰/진행 화면으로 전달
export type PendingCourse = {
  courseId: string;
  place: JourneyPlace;
  courseName: string;
  festivals?: FestivalSummary[];
  mapX?: number;
  mapY?: number;
  scale?: string;
  region?: string; // 출발 지역 표시명 (예: '서울 마포구') — 완료 기록 저장용
};

// 프로필 — 진행 중인 코스 상태
export type CourseProgress = {
  name: string;
  region: string;
  courseId: string;
};

// 프로필 — 완료된 코스 기록
export type CompletedCourse = {
  name: string;
  date: string;
  region: string;
  duration: string;
  places: { name: string; category: string }[];
  rating: number;
  review: string;
};
