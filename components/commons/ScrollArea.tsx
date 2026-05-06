"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/shared/utils";

interface ScrollAreaProps {
  className?: string;
  snapScroll?: boolean;
  children: React.ReactNode;
}

export function ScrollArea({
  className,
  snapScroll = false,
  children,
}: ScrollAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const [thumbVisible, setThumbVisible] = useState(false);
  const [thumbTop, setThumbTop] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(0);

  const calcThumb = useCallback((el: HTMLDivElement) => {
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight) {
      setThumbHeight(0);
      return;
    }
    const ratio = clientHeight / scrollHeight;
    const height = Math.max(ratio * clientHeight, 32);
    const maxTop = clientHeight - height;
    const top = (scrollTop / (scrollHeight - clientHeight)) * maxTop;
    setThumbTop(top);
    setThumbHeight(height);
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    calcThumb(scrollRef.current);
    setThumbVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setThumbVisible(false), 1200);
  }, [calcThumb]);

  useEffect(() => {
    const currentRef = scrollRef.current;
    if (currentRef) calcThumb(currentRef);
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [calcThumb]);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn("h-full overflow-y-auto scrollbar-hide", snapScroll && "snap-y snap-mandatory [webkit-overflow-scrolling:touch]")}
      >
        {children}
      </div>
      {thumbHeight > 0 && (
        <div className="absolute right-1 top-0 bottom-0 w-[3px] pointer-events-none">
          <div
            className={cn(
              "absolute inset-x-0 rounded-full bg-text-primary/25 transition-opacity duration-300",
              thumbVisible ? "opacity-100" : "opacity-0",
            )}
            style={{ top: thumbTop, height: thumbHeight }}
          />
        </div>
      )}
    </div>
  );
}
