import { Trees, Landmark, Bike, Utensils, MapPin } from "lucide-react";
import type { ElementType } from "react";
import { SelectCard } from "@/components/commons/SelectCard";
import type { TourItem } from "@/lib/tour/types";

// 콘텐츠 타입 → 표시 라벨/아이콘
const TYPE_LABEL: Record<string, string> = {
  "12": "관광지",
  "14": "문화시설",
  "28": "레포츠",
  "39": "음식점",
};

const TYPE_ICON: Record<string, ElementType> = {
  "12": Trees,
  "14": Landmark,
  "28": Bike,
  "39": Utensils,
};

type Props = {
  place: TourItem;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
};

export function PlaceCard({ place, loading, disabled, onClick }: Props) {
  const typeLabel = TYPE_LABEL[place.contenttypeid] ?? "";

  return (
    <SelectCard
      className="w-full"
      imageUrl={place.firstimage}
      imageAlt={place.title}
      fallbackIcon={TYPE_ICON[place.contenttypeid] ?? MapPin}
      loading={loading}
      disabled={disabled}
      onClick={onClick}
    >
      <div className="px-2.5 py-2">
        <p className="text-[13px] font-semibold text-text-primary leading-snug line-clamp-2">
          {place.title}
        </p>
        {typeLabel && (
          <p className="text-[11px] text-text-secondary mt-0.5">{typeLabel}</p>
        )}
      </div>
    </SelectCard>
  );
}
