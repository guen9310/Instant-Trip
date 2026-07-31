import { Clock, ChevronRight } from "lucide-react";

export function HoursInfoCard({ placeName }: { placeName: string }) {
  
  return (
    <a
      href={`https://www.google.com/search?q=${encodeURIComponent(`${placeName} 운영시간`)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 flex items-center gap-3.5 py-3.5 px-4 rounded-xl bg-card active:scale-[0.98] transition-transform duration-200"
    >
      <div className="w-9.5 h-9.5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Clock size={18} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-text-secondary leading-none mb-0.5">
          운영시간 정보
        </p>
        <p className="text-[14px] font-semibold text-text-primary leading-snug">
          방문 전 운영시간을 확인해보세요
        </p>
      </div>
      <ChevronRight size={16} className="text-text-secondary shrink-0" />
    </a>
  );
}
