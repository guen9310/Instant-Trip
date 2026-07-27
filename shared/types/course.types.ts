import type { DurationRange } from "@/shared/utils/duration";
import type { Prefs } from "@/shared/constants/preferences";

export type BadgeVariant = "accent" | "secondary" | "point" | "outline";

// 축제 상세 프로그램 — "주요 프로그램" 한 줄 + "부대 행사" 칩 목록으로 구조화한 형태.
// 원문(program, detailIntro2)이 항상 이 구조를 따르진 않아 파싱 실패 시 extra가 빈 배열일
// 수 있다(lib/tour/festivalDetail.ts의 parseFestivalProgram 참조).
export type FestivalProgramInfo = {
  main: string;
  extra: string[];
};

// 축제 진행 단계 — 오늘(KST)이 시작일 이전/기간 내/종료일 이후 중 어디인지.
// isOpenNow(boolean)만으로는 "시작 전"과 "이미 끝남"을 구분할 수 없어서 별도로 둔다.
export type FestivalPhase = "upcoming" | "ongoing" | "ended";

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
  // 카카오 로컬 출처 장소만 채워지는 카카오 장소 상세 페이지 URL(place.map.kakao.com).
  // TourAPI 출처는 카카오 장소 ID가 없어 undefined.
  placeUrl?: string;
  // 축제(contentTypeId=15) + Tour API 매칭된 경우에만 채워진다. 장소·매칭 안 된 축제는
  // undefined — 화면 층은 이 값의 유무로 "행사 프로그램" 섹션 렌더 여부를 결정한다.
  programInfo?: FestivalProgramInfo | null;
  // 축제 주최 홈페이지 URL. 없으면 undefined — 화면 층은 이 값의 유무로 "주최 홈페이지"
  // 버튼 렌더 여부를 결정한다(값 없으면 컴포넌트 자체를 숨긴다, 비활성 상태로 보여주지 않는다).
  organizerUrl?: string | null;
  // 축제만 채워진다(장소는 undefined). CTA 문구·동작 분기에 쓴다.
  festivalPhase?: FestivalPhase;
  // "MM.DD" 포맷 시작일. festivalPhase==="upcoming"일 때 CTA 안내문("07.29부터 방문할 수
  // 있어요")에 쓴다. 축제가 아니면 undefined.
  festivalStartLabel?: string;
};

// 선택 진입(origin="selected") 코스의 가용성 스냅샷 — generateCourseFromPlaceAction이
// 반환하는 형태와 동일하게 유지한다. isOpenNow가 null이면 판단 불가(경고 대상 아님).
export type PlaceAvailabilitySnapshot = {
  isOpenNow: boolean | null;
  hours: string | null;
  restDayNote: string | null;
};

// 코스 결과의 보조 정보 — 진행중/예정 축제 (product-plan.md 4번 "부가" 참조)
// 홈 화면 "주변 축제"에서 축제를 단일 장소로 직접 선택할 때도 이 타입 그대로
// generateCourseFromFestivalAction 페이로드로 쓰인다 — 서버가 재조회 없이 이 필드만으로
// CoursePlace를 조립한다(공공데이터포털 단독 축제는 contentId가 없어 재조회 자체가 불가능하므로).
export type FestivalSummary = {
  id: string;
  name: string;
  status: "ongoing" | "upcoming";
  period: string;
  address: string;
  imageUrl: string | null;
  // 공공데이터포털 fstvlCo(축제 내용) 기반 기본 소개. 없으면 null — 상세 시트가 조건부로 렌더한다.
  description: string | null;
  // Tour API와 매칭된 경우에만 존재. 상세 시트가 이 값으로 detailIntro2를 호출해
  // program(행사 프로그램)으로 description을 보강한다.
  contentId: string | null;
  lat: number;
  lng: number;
  // 원본 날짜(YYYY-MM-DD) — period는 표시용 포맷이라 다시 파싱하지 않는다.
  startDate: string;
  endDate: string;
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
    // 카카오 로컬 출처 장소만 있음 — 없으면 좌표 기반 카카오 지도 검색 링크로 대체한다.
    placeUrl: string | null;
  }[];
  rating: number;
  review: string;
};
