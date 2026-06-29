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
