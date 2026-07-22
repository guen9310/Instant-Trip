import type { DurationRange } from "@/shared/utils/duration";
import type { Prefs } from "@/shared/constants/preferences";

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
  tags: string[];
  // 이 장소가 취향 추천(stage4 점수화)으로 왔는지, 홈 근처 카드에서 직접 선택했는지.
  // 구버전 localStorage 페이로드엔 없을 수 있어 optional.
  origin?: "recommended" | "selected";
};

// 선택 진입(origin="selected") 코스의 가용성 스냅샷 — generateCourseFromPlaceAction이
// 반환하는 형태와 동일하게 유지한다. isOpenNow가 null이면 판단 불가(경고 대상 아님).
export type PlaceAvailabilitySnapshot = {
  isOpenNow: boolean | null;
  hours: string | null;
  restDayNote: string | null;
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
  // 생성 시점 취향 스냅샷 — 결과 화면 표시·재추천용. "이 코스가 어떤 취향으로
  // 만들어졌나"를 보존한다 (구버전 localStorage 페이로드엔 없을 수 있음)
  prefs?: Prefs;
  // startCourseAction이 반환한 DB row ID — 완료 시 INSERT 대신 UPDATE에 사용
  completionId?: string;
  dbCourseId?: string;
  // 선택 진입(place.origin==="selected")에서만 채워진다 — 추천 진입은 이 필드를 모른다.
  availability?: PlaceAvailabilitySnapshot;
  // 코스 생성 성공 시점(epoch ms). 운영시간 배지는 이 시점의 실시간 판정을 스냅샷으로
  // 저장한 것이므로, 오래 지난 스냅샷은 화면 층에서 배지를 숨기는 만료 판단에 쓴다.
  generatedAt?: number;
};

// /course/active/[id] 서버 컴포넌트가 미리 조회해두는 DB 기반 이어서 데이터.
// localStorage의 pendingCourse가 없거나(다른 기기·저장소 초기화) URL의 courseId와
// 다를 때, 프로필 "이어서"가 가리키는 courseId(DB courses.id)로 화면을 복원하는 데 쓴다.
export type ResumableCourse = {
  completionId: string;
  courseId: string;
  courseName: string;
  scale: string;
  place: JourneyPlace;
};

// 프로필 — 진행 중인 코스 상태
export type CourseProgress = {
  name: string;
  courseId: string;
};

// 프로필 — 완료된 코스 기록
export type CompletedCourse = {
  id: string;
  name: string;
  date: string;
  duration: string;
  places: {
    name: string;
    category: string;
    address: string;
    description: string;
    badge: { text: string; variant: BadgeVariant };
    availabilityUncertain: boolean;
    coord: { lat: number; lng: number } | null;
  }[];
  rating: number;
  review: string;
};
