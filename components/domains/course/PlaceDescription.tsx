import { useState, useEffect, useRef } from "react";
import { cn } from "@/shared/utils";

// 소개 2줄 클램프 + 더보기/접기 — key={place.id}로 장소가 바뀔 때마다 새로 마운트되어
// expanded/hasMore 상태가 항상 새 장소 기준으로 초기화된다(PlaceDetailSheet가 쓰던 방식과 동일).
export function PlaceDescription({ desc }: { desc: string }) {
  const [expanded, setExpanded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) setHasMore(el.scrollHeight > el.clientHeight);
  }, []);

  return (
    <div className="mt-3 flex flex-col gap-1">
      <p
        ref={ref}
        className={cn(
          "text-[14px] text-text-primary leading-[1.55]",
          !expanded && "line-clamp-2",
        )}
      >
        {desc}
      </p>
      {hasMore && (
        <div className="flex justify-end">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-primary text-xs font-semibold hover:underline"
          >
            {expanded ? "접기" : "더보기"}
          </button>
        </div>
      )}
    </div>
  );
}
