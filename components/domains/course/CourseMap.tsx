"use client";

import { useState, useEffect } from "react";
import { Map, MapMarker, useMap } from "react-kakao-maps-sdk";
import { MapPin } from "lucide-react";
import type { NearbyPoi } from "@/shared/types/course.types";

type Coord = { lat: number; lng: number };

type Props = {
  mainPlace: { name: string; coord: Coord };
  pois?: NearbyPoi[];
  selectedPoiId?: string | null;
  onSelectPoi?: (id: string | null) => void;
};

export function CourseMapPlaceholder() {
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
        <span className="text-[11px] font-semibold">현재 위치</span>
      </div>
    </div>
  );
}

// Map 내부에서 useMap()으로 인스턴스를 받아 bounds를 조정하는 컴포넌트
function BoundsAdjuster({ coords }: { coords: Coord[] }) {
  const map = useMap("BoundsAdjuster");

  useEffect(() => {
    if (coords.length === 0) return;

    const bounds = new kakao.maps.LatLngBounds();
    coords.forEach(({ lat, lng }) => bounds.extend(new kakao.maps.LatLng(lat, lng)));
    map.setBounds(bounds, 60); // 60px padding
  }, [map, coords]);

  return null;
}

export function CourseMap({ mainPlace, pois = [], selectedPoiId, onSelectPoi }: Props) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const kakao = (
      window as unknown as { kakao?: { maps?: { load: (cb: () => void) => void } } }
    ).kakao;
    kakao?.maps?.load(() => setLoaded(true));
  }, []);

  if (!loaded) return <CourseMapPlaceholder />;

  const allCoords: Coord[] = [
    mainPlace.coord,
    ...pois.map((p) => p.coord).filter((c): c is Coord => !!(c?.lat && c?.lng)),
  ];

  return (
    <div className="w-full h-full">
      <Map
        center={mainPlace.coord}
        style={{ width: "100%", height: "100%" }}
        level={3}
      >
        <BoundsAdjuster coords={allCoords} />

        {/* 현재 장소 마커 */}
        <MapMarker position={mainPlace.coord} />

        {/* POI 마커 — 클릭 또는 목록 탭 시 이름 표시 */}
        {pois.map((poi) => (
          <MapMarker
            key={poi.id}
            position={poi.coord}
            image={{
              src: POI_MARKER_ICON[poi.category],
              size: { width: 28, height: 36 },
            }}
            onClick={() => onSelectPoi?.(selectedPoiId === poi.id ? null : poi.id)}
          />
        ))}
      </Map>
    </div>
  );
}

// lucide-react 아이콘 path를 핀 마커 SVG에 인라인 (24x24 viewBox → 10x10 영역으로 축소, 중앙 14,14)
function pinMarkerSvg(fill: string, iconPaths: string) {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">`,
    `<path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22S28 24.5 28 14C28 6.27 21.73 0 14 0z" fill="${fill}"/>`,
    `<g transform="translate(7,7) scale(0.5833)" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">`,
    iconPaths,
    `</g>`,
    `</svg>`,
  ].join("");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const ICON_PATHS = {
  coffee:       `<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>`,
  shoppingBag:  `<path d="M16 10a4 4 0 0 1-8 0"/><path d="M3.103 6.034h17.794"/><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/>`,
  plus:         `<path d="M5 12h14"/><path d="M12 5v14"/>`,
  utensils:     `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`,
  squareParking:`<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>`,
  fuel:         `<path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5"/><path d="M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16"/><path d="M2 21h13"/><path d="M3 9h11"/>`,
};

const POI_MARKER_ICON: Record<Exclude<import("@/shared/types/course.types").NearbyCategory, "all">, string> = {
  cafe:         pinMarkerSvg("#7C3AED", ICON_PATHS.coffee),
  convenience:  pinMarkerSvg("#EA580C", ICON_PATHS.shoppingBag),
  pharmacy:     pinMarkerSvg("#16A34A", ICON_PATHS.plus),
  restaurant:   pinMarkerSvg("#F97316", ICON_PATHS.utensils),
  parking:      pinMarkerSvg("#0EA5E9", ICON_PATHS.squareParking),
  gas_station:  pinMarkerSvg("#EAB308", ICON_PATHS.fuel),
};
