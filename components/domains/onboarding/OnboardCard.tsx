import type { ReactNode } from "react";
import { cn } from "@/shared/utils";

interface OnboardCardProps {
  icon: ReactNode;
  title: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}

export function OnboardCard({ icon, title, desc, selected, onClick }: OnboardCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[152px] flex-col items-center gap-2.5 rounded-xl px-3.5 pb-[22px] pt-[32px] text-center transition-transform",
        selected
          ? "scale-[0.98] border-[1.5px] border-accent bg-accent/10"
          : "scale-100 border-[1.5px] border-border bg-card",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      <div className="mb-1 flex h-[52px] w-[52px] items-center justify-center rounded-xl">
        {icon}
      </div>
      <div className="text-[17px] font-bold tracking-tight text-text-primary">
        {title}
      </div>
      <div className="text-[12px] leading-relaxed text-text-secondary">
        {desc}
      </div>
    </button>
  );
}
