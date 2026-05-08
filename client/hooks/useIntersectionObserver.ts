import { useEffect, useLayoutEffect, useRef } from "react";

export function useIntersectionObserver(
  onIntersect: () => void,
  threshold = 0.1,
) {
  const ref = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onIntersect);
  useLayoutEffect(() => {
    callbackRef.current = onIntersect;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) callbackRef.current();
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref };
}
