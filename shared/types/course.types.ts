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
};

export type NearbyCategory = "all" | "cafe" | "restroom" | "convenience" | "pharmacy";

export type NearbyPoi = {
  id: string;
  category: Exclude<NearbyCategory, "all">;
  name: string;
  dist: string;
  isOpen: boolean;
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
