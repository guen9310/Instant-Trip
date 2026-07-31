import type { ComponentType } from "react";
import { Coffee, ShoppingBag, Pill, Utensils, SquareParking, Fuel } from "lucide-react";
import type { NearbyPoi } from "@/shared/types/course.types";
import type { PoiCategory } from "@/shared/constants/poiCategory";

// 길찾기 컨텍스트 스트립·버튼 아이콘 — CourseActiveView의 CATEGORY_META와 동일한
// 카테고리↔아이콘 매핑(단일 출처는 아니지만 같은 선택을 따름, courseMapMarkers.ts의
// ICON_PATHS도 이미 같은 아이콘을 별도로 인라인 SVG화해 쓰고 있는 것과 같은 사정).
export const POI_CATEGORY_ICON: Record<
  PoiCategory,
  ComponentType<{ size?: number; strokeWidth?: number; className?: string; color?: string }>
> = {
  cafe: Coffee,
  convenience: ShoppingBag,
  pharmacy: Pill,
  restaurant: Utensils,
  parking: SquareParking,
  gas_station: Fuel,
};

export function StripCategoryIcon({ poi, color }: { poi: NearbyPoi; color: string }) {
  const Icon = POI_CATEGORY_ICON[poi.category];
  return <Icon size={12} strokeWidth={2.2} className="shrink-0" color={color} />;
}
