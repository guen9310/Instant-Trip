import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export function useIntersectionObserver(
  onIntersect: () => void,
  threshold = 0.1,
) {
  const callbackRef = useRef(onIntersect);
  useLayoutEffect(() => {
    callbackRef.current = onIntersect;
  });

  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    setElement(el);
  }, []);

  useEffect(() => {
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) callbackRef.current();
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, threshold]);

  return { ref };
}
