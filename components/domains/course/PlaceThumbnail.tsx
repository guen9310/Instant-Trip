"use client";

import { useState } from "react";
import Image from "next/image";
import { Trees, Landmark, Bike, MapPin } from "lucide-react";
import type { ElementType } from "react";
import { cn } from "@/shared/utils";

const CAT_ICON: Record<string, ElementType> = {
  관광지: Trees,
  문화시설: Landmark,
  레포츠: Bike,
};

type Props = {
  imageUrl: string | null;
  cat: string;
  className?: string;
  sizes?: string;
};

export function PlaceThumbnail({ imageUrl, cat, className, sizes }: Props) {
  const [hasError, setHasError] = useState(false);
  // 재추천(reroll)으로 currentPlace가 바뀌어도 이 컴포넌트는 key 없이 재사용된다
  // (CourseResultView.tsx 참고). imageUrl이 바뀌었는데 이전 렌더의 hasError를
  // 그대로 들고 있으면, 새 이미지가 유효해도 실패 플레이스홀더가 계속 보인다.
  // useEffect로 뒤늦게 리셋하면 한 프레임 깜빡이므로, React 공식 관용구(렌더 중
  // prop 변화 감지 + 렌더 중 setState)로 같은 렌더에서 바로 리셋한다.
  const [prevImageUrl, setPrevImageUrl] = useState(imageUrl);
  if (imageUrl !== prevImageUrl) {
    setPrevImageUrl(imageUrl);
    setHasError(false);
  }
  const Icon = CAT_ICON[cat] ?? MapPin;

  if (imageUrl && !hasError) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes={sizes}
          className="object-cover"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center justify-center bg-muted/60", className)}
    >
      <Icon size={28} className="text-muted-foreground/50" strokeWidth={1.5} />
    </div>
  );
}
