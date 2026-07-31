import { ChevronRight } from "lucide-react";
import type { ElementType } from "react";

export function OptionCard({
  icon: Ico,
  title,
  sub,
  onClick,
}: {
  icon: ElementType;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3.5 px-3.5 py-3.5 rounded-xl bg-surface border border-border active:bg-primary/5 active:border-primary/30 transition-colors text-left w-full"
    >
      <div className="w-10 h-10 rounded-[10px] bg-primary/8 text-primary flex items-center justify-center shrink-0">
        <Ico size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-text-primary tracking-tight mb-0.5">{title}</p>
        <p className="text-xs text-text-secondary">{sub}</p>
      </div>
      <ChevronRight size={18} className="text-text-secondary shrink-0" />
    </button>
  );
}
