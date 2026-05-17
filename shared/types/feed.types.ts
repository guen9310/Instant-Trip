export type AvailabilityStatus = "available" | "partial" | "unavailable";

export type Place = {
  name: string;
  category: string;
  status: "open" | "closed";
  description?: string;
};

export type TodayCompletions = {
  count: number;
  timeframe: "방금" | "오늘";
};

export type CourseData = {
  id: string;
  name: string;
  region: string;
  rating: number;
  count: number;
  availability: AvailabilityStatus;
  todayCompletions?: TodayCompletions;
  festival?: boolean;
  imageSeed?: string;
  places: Place[];
  contextLabel?: string;
};
