import { FeedList } from "@/components/domains/feed/FeedList";
import { FeedWeatherHeader } from "@/components/domains/feed/FeedWeatherHeader";
import { FeedStartCard } from "@/components/domains/feed/FeedStartCard";

export default function FeedPage() {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-5">
      <FeedStartCard />
      <FeedWeatherHeader />
      <FeedList />
    </div>
  );
}
