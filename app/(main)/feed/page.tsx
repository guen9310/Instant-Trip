import { FeedList } from "@/components/domains/feed/FeedList";
import { FeedLocationSection } from "@/components/domains/feed/FeedLocationSection";
import {
  FEED_FEATURED,
  FEED_MID_COURSES,
  FEED_SMALL_COURSES,
  FEED_LIST_COURSES,
} from "@/shared/constants/feedMock";

export default function FeedPage() {
  // TODO: 실제 API 연결 후 서버에서 fetch한 데이터로 교체
  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-5">
      <FeedLocationSection />
      <FeedList
        featured={FEED_FEATURED}
        midCourses={FEED_MID_COURSES}
        smallCourses={FEED_SMALL_COURSES}
        listCourses={FEED_LIST_COURSES}
      />
    </div>
  );
}
