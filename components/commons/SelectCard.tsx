import type { ElementType, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { ImagePlaceholder } from "@/components/commons/ImagePlaceholder";
import { cn, isBlank } from "@/shared/utils";

type Props = {
  className?: string;
  imageUrl?: string | null;
  imageAlt: string;
  fallbackIcon: ElementType;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
};

// 이미지 또는 플레이스홀더 + 진행 중 스피너 오버레이를 가진 선택형 썸네일 카드.
// 도메인 무관 — 카드 안쪽 콘텐츠는 children으로 호출부가 채운다.
export function SelectCard({
  className,
  imageUrl,
  imageAlt,
  fallbackIcon,
  loading,
  disabled,
  onClick,
  children,
}: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative text-left rounded-xl overflow-hidden border border-border bg-card active:scale-[0.98] transition-transform duration-150",
        disabled && !loading && "opacity-40",
        className,
      )}
    >
      {!isBlank(imageUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl!} alt={imageAlt} className="w-full aspect-video object-cover" />
      ) : (
        <ImagePlaceholder icon={fallbackIcon} className="w-full aspect-video" />
      )}
      {children}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80">
          <Loader2 size={20} className="animate-spin text-primary" />
        </div>
      )}
    </button>
  );
}
