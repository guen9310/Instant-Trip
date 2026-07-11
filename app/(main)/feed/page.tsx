import { FeedList } from "@/components/domains/feed/FeedList";
import { FeedLocationSection } from "@/components/domains/feed/FeedLocationSection";
import { getFeedCourses } from "@/server/queries";

export default async function FeedPage() {
  const { featured, midCourses, smallCourses, listCourses } =
    await getFeedCourses();

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-5">
      <FeedLocationSection />
      <FeedList
        featured={featured}
        midCourses={midCourses}
        smallCourses={smallCourses}
        listCourses={listCourses}
      />
    </div>
  );
}
