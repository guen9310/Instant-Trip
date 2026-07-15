"use client";

import { REGIONS } from "@/lib/tour/regionMap";
import { useLocationStore } from "@/client/stores/useLocationStore";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/commons/Drawer";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect?: (name: string) => void;
};

export function RegionSelectSheet({ open, onClose, onSelect }: Props) {
  const { setCity } = useLocationStore();

  const handleSelect = (name: string) => {
    const region = REGIONS.find((r) => r.name === name);
    setCity(name, name, region?.lat, region?.lng);
    onSelect?.(name);
    onClose();
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>지역을 선택해주세요</DrawerTitle>
        </DrawerHeader>
        <div className="grid grid-cols-3 gap-2 px-4 pb-[calc(16px+env(safe-area-inset-bottom,8px))]">
          {REGIONS.map((r) => (
            <button
              key={r.name}
              onClick={() => handleSelect(r.name)}
              className="py-3.5 rounded-xl border border-border bg-surface text-[14px] font-medium text-text-primary text-center active:scale-[0.98] transition-transform"
            >
              {r.name}
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
