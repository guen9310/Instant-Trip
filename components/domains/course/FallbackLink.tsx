import { UtensilsCrossed, ExternalLink } from "lucide-react";
import { extractRegion } from "@/components/domains/course/extractRegion";

export function FallbackLink({ placeName, addr }: { placeName: string; addr: string }) {
  const region = extractRegion(addr);
  return (
    <a
      href={`https://map.kakao.com/?q=${encodeURIComponent(region + " 맛집")}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border"
    >
      <div className="w-9 h-9 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0">
        <UtensilsCrossed size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-secondary">근처 맛집 찾기</p>
        <p className="text-[14px] font-semibold text-text-primary truncate">
          {placeName} 주변 음식점 보기
        </p>
      </div>
      <ExternalLink size={14} className="text-text-secondary shrink-0" />
    </a>
  );
}
