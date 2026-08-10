import { PartyPopper } from "lucide-react";
import { SelectCard } from "@/components/commons/SelectCard";
import { AttributionNotice } from "@/components/commons/AttributionNotice";
import type { FestivalSummary } from "@/shared/types/course.types";
import { cn } from "@/shared/utils";

type Props = {
  festivals: FestivalSummary[];
  startingId: string | null;
  onSelectFestival: (festival: FestivalSummary) => void;
};

export function FestivalSection({ festivals, startingId, onSelectFestival }: Props) {
  return (
    <section className="mb-6">
      <h2 className="flex items-center gap-1 text-[15px] font-bold text-text-primary tracking-tight mb-3">
        주변 축제
        <AttributionNotice>
          문화체육관광부·한국관광공사 제공
        </AttributionNotice>
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {festivals.map((f) => (
          <SelectCard
            key={f.id}
            className="shrink-0 w-48"
            imageUrl={f.imageUrl}
            imageAlt={f.name}
            fallbackIcon={PartyPopper}
            loading={startingId === f.id}
            disabled={startingId !== null}
            onClick={() => onSelectFestival(f)}
          >
            <div className="px-3 pt-2 pb-3">
              <div className="mb-1.5">
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                    f.status === "ongoing"
                      ? "bg-accent/15 text-accent"
                      : "bg-secondary/15 text-secondary",
                  )}
                >
                  {f.status === "ongoing" ? "진행중" : "예정"}
                </span>
              </div>
              <p className="text-[13px] font-semibold text-text-primary leading-snug line-clamp-2">
                {f.name}
              </p>
              <p className="text-[11px] text-text-secondary mt-1">{f.period}</p>
            </div>
          </SelectCard>
        ))}
      </div>
    </section>
  );
}
