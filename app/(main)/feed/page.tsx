import { FeedLocationSection } from "@/components/domains/feed/FeedLocationSection";

export default async function FeedPage() {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-5">
      <FeedLocationSection />
      {/* TODO: 홈 콘텐츠 (축제/근처 장소) */}
    </div>
  );
}
