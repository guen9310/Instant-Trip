import { MapPin } from "lucide-react";

export function CourseMapPlaceholder() {
  return (
    <div className="w-full h-full border-b border-border bg-accent/9 relative overflow-hidden">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 343 160"
        className="absolute inset-0"
      >
        <path
          d="M40 130 Q 110 60, 180 90 T 310 60"
          fill="none"
          strokeWidth="2.5"
          strokeDasharray="6 4"
          className="stroke-accent"
        />
        <circle cx="40" cy="130" r="22" fillOpacity="0.18" className="fill-accent" />
      </svg>
      <div className="relative flex flex-col items-center justify-center h-full gap-1.5 text-accent">
        <MapPin size={28} strokeWidth={2.2} />
        <span className="text-[11px] font-semibold">현재 장소</span>
      </div>
    </div>
  );
}
