import { MapPin } from "lucide-react";

// 지도 SDK 로드 중에는 인자 없이 쓰고, 로드에 실패했으면 failed로 안내 문구를 띄운다.
// externalUrl을 넘기면 카카오맵 웹으로 여는 대안 링크를 함께 보여준다.
export function CourseMapPlaceholder({
  failed = false,
  externalUrl,
}: {
  failed?: boolean;
  externalUrl?: string;
} = {}) {
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
        <span className="text-[11px] font-semibold">
          {failed ? "지도를 불러오지 못했어요" : "현재 장소"}
        </span>
        {failed && externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold underline underline-offset-2"
          >
            카카오맵에서 보기
          </a>
        )}
      </div>
    </div>
  );
}
