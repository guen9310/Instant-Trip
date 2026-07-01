export type BadgeVariant = "accent" | "secondary" | "point" | "outline";

// 코스 진행 중 한 장소의 상세 데이터 (여정 화면에서 사용)
export type JourneyPlace = {
  id: string;
  cat: string;
  name: string;
  addr: string;
  hours: string;
  time: string;
  dur: string;
  travel: string;
  badge: { text: string; variant: BadgeVariant };
  desc: string;
  coord: { lat: number; lng: number } | null;
  imageUrl: string | null;
  availabilityUncertain: boolean;
  estimatedDurationMin: number;
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

// 코스 결과의 보조 정보 — preferFood=true일 때만 채워지는 식당 1곳 추천
export type RecommendedFoodSummary = {
  name: string;
  category: string;
  distance: string;
  url: string;
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

// 프로필 — 진행 중인 코스 상태
export type CourseProgress = {
  name: string;
  current: number;
  total: number;
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
