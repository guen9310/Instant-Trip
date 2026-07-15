"use client";

import { MapPin, Calendar, ExternalLink } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/commons/Drawer";
import { Badge } from "@/components/commons/Badge";
import type { FestivalSummary } from "@/shared/types/course.types";

type Props = {
  festival: FestivalSummary | null;
  onClose: () => void;
};

export function FestivalDetailSheet({ festival, onClose }: Props) {
  return (
    <Drawer open={!!festival} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DrawerContent>
        <DrawerTitle className="sr-only">{festival?.name ?? "축제 정보"}</DrawerTitle>
        {festival && <FestivalDetailContent festival={festival} />}
      </DrawerContent>
    </Drawer>
  );
}

function FestivalDetailContent({ festival }: { festival: FestivalSummary }) {
  return (
    <div className="px-5 pb-[calc(24px+env(safe-area-inset-bottom,8px))]">
      {festival.imageUrl && (
        <img
          src={festival.imageUrl}
          alt={festival.name}
          className="w-full h-44 object-cover rounded-xl mb-4"
        />
      )}
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className="text-[20px] font-bold text-text-primary tracking-tight leading-snug flex-1">
          {festival.name}
        </h2>
        <Badge variant={festival.status === "ongoing" ? "accent" : "outline"}>
          {festival.status === "ongoing" ? "진행중" : "예정"}
        </Badge>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <Calendar size={16} className="text-text-secondary shrink-0" />
          <span className="text-[14px] text-text-primary">{festival.period}</span>
        </div>
        {festival.address && (
          <div className="flex items-start gap-2.5">
            <MapPin size={16} className="text-text-secondary shrink-0 mt-0.5" />
            <span className="text-[14px] text-text-primary leading-snug">{festival.address}</span>
          </div>
        )}
      </div>
      <a
        href={`https://www.google.com/search?q=${encodeURIComponent(festival.name)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 flex items-center justify-center gap-1.5 w-full h-12 rounded-xl bg-primary/8 text-primary text-[14px] font-medium"
      >
        <ExternalLink size={15} /> 더 알아보기
      </a>
    </div>
  );
}
