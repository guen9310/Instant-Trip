"use client";

import { useState } from "react";
import { AlertCircle, MapPin, RefreshCw } from "lucide-react";
import { useLocationStore } from "@/client/stores/useLocationStore";
import { RegionSelectSheet } from "@/components/domains/location/RegionSelectSheet";

interface LocationDeniedViewProps {
  onCitySelect?: (city: string, sidoName: string) => void;
  variant?: "denied" | "manual";
}

export function LocationDeniedView({
  onCitySelect,
  variant = "denied",
}: LocationDeniedViewProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { requestPermission, state } = useLocationStore();
  const isSystemDenied = state.status === "system-denied";

  const handleSelect = (name: string) => {
    onCitySelect?.(name, name);
  };

  return (
    <div className="px-4 pt-6 pb-4">
      {variant === "denied" && (
        <div className="flex gap-2.5 items-start px-3.5 py-3 rounded-[10px] bg-point/12 border border-point/20 mb-6">
          <AlertCircle
            size={18}
            className="text-point shrink-0 mt-0.5"
            strokeWidth={2}
          />
          <div>
            <p className="text-[13px] font-bold text-text-primary mb-0.5">
              위치 권한이 거부되었어요
            </p>
            <p className="text-[12px] text-text-secondary leading-[1.4]">
              {isSystemDenied
                ? "브라우저 설정에서 이 사이트의 위치 권한을 허용한 뒤 돌아오세요"
                : "지역을 직접 선택하거나 권한을 다시 요청해주세요"}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {!isSystemDenied && (
          <button
            onClick={() => requestPermission()}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-[10px] border border-border bg-surface text-[14px] font-semibold text-text-primary"
          >
            <RefreshCw size={15} strokeWidth={2} />
            권한 다시 요청
          </button>
        )}
        <button
          onClick={() => setSheetOpen(true)}
          className="flex items-center justify-center gap-2 w-full h-12 rounded-[10px] bg-accent text-white text-[14px] font-bold"
        >
          <MapPin size={15} strokeWidth={2} />
          지역 선택
        </button>
      </div>

      <RegionSelectSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSelect={handleSelect}
      />
    </div>
  );
}
