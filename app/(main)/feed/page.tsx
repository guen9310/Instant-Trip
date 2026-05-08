import { FeedList } from "@/components/domains/feed/FeedList";
import { FeedWeatherHeader } from "@/components/domains/feed/FeedWeatherHeader";

export default function FeedPage() {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-5">
      <FeedWeatherHeader />
      <FeedList />
    </div>
  );
}
