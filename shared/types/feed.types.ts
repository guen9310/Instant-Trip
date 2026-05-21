export type AvailabilityStatus = "available" | "partial" | "unavailable";

// 피드 바텀시트에서 장소 목록 미리보기용 경량 타입
export type FeedPlace = {
  name: string;
  category: string;
  status: "open" | "closed";
  description?: string;
};

export type TodayCompletions = {
  count: number;
  timeframe: "방금" | "오늘";
};

// 피드 카드 및 바텀시트에서 사용하는 코스 데이터
export type FeedCourse = {
  id: string;
  name: string;
  region: string;
  rating: number;
  count: number;
  availability: AvailabilityStatus;
  todayCompletions?: TodayCompletions;
  festival?: boolean;
  imageSeed?: string;
  places: FeedPlace[];
  contextLabel?: string;
};
