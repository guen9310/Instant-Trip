"use client";

import { MapPin } from "lucide-react";
import { Button } from "@/components/commons/Button";
import { Sheet, SheetContent } from "@/components/commons/Sheet";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAllow: () => void;
}

export function LocationPermissionSheet({ open, onOpenChange, onAllow }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="rounded-t-2xl gap-0 px-6 pt-6 pb-[calc(24px+env(safe-area-inset-bottom,8px))]"
      >
        <div className="flex flex-col items-center text-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <MapPin size={26} strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-text-primary mb-1.5">
              위치 권한이 필요해요
            </h2>
            <p className="text-[13px] text-text-secondary leading-[1.6]">
              현재 위치를 기반으로 코스를 만들어드려요.
              <br />
              권한을 허용하지 않으면 코스를 추천받을 수 없어요.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button size="cta" onClick={onAllow}>
            위치 허용하기
          </Button>
          <button
            onClick={() => onOpenChange(false)}
            className="w-full h-12 text-[14px] font-medium text-text-secondary flex items-center justify-center"
          >
            나중에
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
