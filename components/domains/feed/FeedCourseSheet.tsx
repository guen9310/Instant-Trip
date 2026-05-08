"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, MapPin } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/commons/Sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/commons/Accordion";
import { Button } from "@/components/commons/Button";
import type { CourseData, Place } from "@/shared/types/feed.types";

type SheetPhase = "default" | "partial" | "loading" | "updated";

type ChangedPlace = { from: string; to: string };

const categoryFallbacks: Record<string, string> = {
  문화시설: "서울숲 공원",
  관광지: "용산가족공원",
  음식점: "마포 맛집거리",
  레포츠: "뚝섬 수상스포츠",
};

export function FeedCourseSheet({
  course,
  open,
  onOpenChange,
}: {
  course: CourseData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<SheetPhase>(
    () => !course || course.availability === "available" ? "default" : "partial",
  );
  const [displayPlaces, setDisplayPlaces] = useState<Place[]>(
    () => course?.places ?? [],
  );
  const [changedPlace, setChangedPlace] = useState<ChangedPlace | null>(null);

  const handleExcludeAndRun = () => {
    setPhase("loading");
    setTimeout(() => {
      if (!course) return;
      const closedIdx = displayPlaces.findIndex((p) => p.status === "closed");
      if (closedIdx !== -1) {
        const closed = displayPlaces[closedIdx];
        const toName = categoryFallbacks[closed.category] ?? "주변 인기 장소";
        const replacement: Place = {
          name: toName,
          category: closed.category,
          status: "open",
        };
        const next = [...displayPlaces];
        next[closedIdx] = replacement;
        setDisplayPlaces(next);
        setChangedPlace({ from: closed.name, to: toName });
      }
      setPhase("updated");
    }, 1500);
  };

  const handleGoActive = () => {
    onOpenChange(false);
    router.push(`/course/${course?.id}/active`);
  };

  if (!course) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => onOpenChange(o)}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl overflow-y-auto max-h-[80vh] dark:bg-surface"
      >
        {phase === "loading" ? (
          <div className="flex flex-col items-center justify-center min-h-[280px] gap-4">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-[14px] text-text-secondary">
              코스를 업데이트하는 중...
            </p>
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="text-[18px] font-bold tracking-[-0.01em]">
                {course.name}
              </SheetTitle>
              <SheetDescription>
                <a
                  href={`https://map.kakao.com/link/search/${encodeURIComponent(course.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-accent transition-colors"
                >
                  <MapPin size={13} />
                  {course.region}
                </a>
              </SheetDescription>
            </SheetHeader>

            <Accordion className="px-4">
              {displayPlaces.map((place, i) => {
                const isChanged = changedPlace?.to === place.name;
                const statusBadge =
                  place.status === "open" ? (
                    <span className="text-[12px] text-accent font-medium flex items-center gap-1 shrink-0">
                      <CheckCircle2 size={12} />
                      영업중
                    </span>
                  ) : (
                    <span className="text-[12px] text-muted-foreground flex items-center gap-1 shrink-0">
                      <AlertTriangle size={12} />
                      현재 미운영
                    </span>
                  );

                if (!place.description) {
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between py-3 border-b border-border last:border-b-0"
                    >
                      <span
                        className={`text-[14px] ${isChanged ? "text-accent font-medium" : "text-text-primary"}`}
                      >
                        {place.name}
                      </span>
                      {statusBadge}
                    </div>
                  );
                }

                return (
                  <AccordionItem
                    key={i}
                    value={`place-${i}`}
                    className="last:border-b-0"
                  >
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex flex-1 items-center justify-between mr-2">
                        <span
                          className={`text-[14px] ${isChanged ? "text-accent font-medium" : "text-text-primary"}`}
                        >
                          {place.name}
                        </span>
                        {statusBadge}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-[13px] text-text-secondary leading-relaxed">
                        {place.description}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            {phase === "partial" && (
              <p className="text-[13px] text-text-secondary px-4 leading-relaxed">
                일부 장소가 현재 운영 중이 아니에요. 해당 장소를 제외하고
                실행할까요?
              </p>
            )}

            {phase === "updated" && changedPlace && (
              <p className="text-[12px] text-accent px-4">
                {changedPlace.from} 대신 {changedPlace.to}으로 변경됐어요
              </p>
            )}

            <SheetFooter>
              {phase === "default" && (
                <Button size="cta" onClick={handleGoActive}>
                  나도 이 코스 가볼게요
                </Button>
              )}
              {phase === "partial" && (
                <>
                  <Button size="cta" onClick={handleExcludeAndRun}>
                    제외하고 실행
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full h-[40px]"
                    onClick={() => onOpenChange(false)}
                  >
                    취소
                  </Button>
                </>
              )}
              {phase === "updated" && (
                <Button size="cta" onClick={handleGoActive}>
                  이 코스로 갈게요
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
