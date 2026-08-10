"use client";

import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/commons/Popover";

type Props = {
  children: React.ReactNode;
  className?: string;
};

// 공공누리 제1유형 등 출처표시 의무가 있는 데이터를 쓰는 지점에 붙이는 작은 안내 아이콘.
// 화면 상시 노출 대신 탭했을 때만 출처를 보여줘 디자인에 미치는 영향을 최소화한다.
export function AttributionNotice({ children, className }: Props) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="데이터 출처 안내"
        className={className ?? "text-text-secondary/70 shrink-0"}
      >
        <Info size={13} strokeWidth={2} />
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[240px] text-[11px] text-text-secondary leading-relaxed">
        {children}
      </PopoverContent>
    </Popover>
  );
}
