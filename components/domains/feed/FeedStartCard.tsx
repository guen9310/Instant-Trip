import Link from "next/link";
import { MapPin, Zap } from "lucide-react";

export function FeedStartCard() {
  return (
    <Link
      href="/start"
      className="block rounded-2xl bg-card border border-primary/20 px-5 py-4 mb-5"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <MapPin size={13} className="text-text-secondary shrink-0" />
        <span className="text-[12px] text-text-secondary">서울특별시 종로구</span>
        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
        <span className="text-[11px] text-accent font-semibold">위치 확인됨</span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[19px] font-extrabold text-text-primary tracking-[-0.02em] leading-tight">
            지금 바로 떠날 수 있어요
          </p>
          <p className="text-[12px] text-text-secondary mt-1">
            취향에 맞는 코스를 즉석에서 만들어드려요
          </p>
        </div>
        <span className="shrink-0 flex items-center gap-1.5 bg-primary text-primary-foreground text-[13px] font-bold px-3.5 py-2 rounded-xl whitespace-nowrap">
          <Zap size={13} strokeWidth={2.5} />
          코스 뽑기
        </span>
      </div>
    </Link>
  );
}
