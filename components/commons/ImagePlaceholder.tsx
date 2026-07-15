import type { ElementType } from "react";
import { cn } from "@/shared/utils";

type Props = {
  icon: ElementType;
  className?: string;
};

export function ImagePlaceholder({ icon: Icon, className }: Props) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br from-muted/80 to-muted/50",
        className,
      )}
    >
      <Icon size={28} className="text-muted-foreground/40" strokeWidth={1.5} />
    </div>
  );
}
