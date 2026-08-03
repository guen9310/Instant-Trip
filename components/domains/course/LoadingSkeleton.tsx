import { cn } from "@/shared/utils";

export function LoadingSkeleton() {
  return (
    <div className="rounded-xl bg-card border border-border p-3.5 animate-pulse">
      <div className="h-3 w-16 bg-muted rounded mb-3" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-3 py-2.5",
            i < 2 && "border-b border-border/60",
          )}
        >
          <div className="w-5 h-3 bg-muted rounded shrink-0" />
          <div className="flex-1">
            <div className="h-3 w-2/3 bg-muted rounded mb-1.5" />
            <div className="h-2.5 w-1/3 bg-muted rounded" />
          </div>
          <div className="h-2.5 w-8 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}
