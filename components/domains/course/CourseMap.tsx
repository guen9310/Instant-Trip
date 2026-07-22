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
  // 마커만 안 보이게 하고 지도 확대 범위(bounds)는 그대로 유지한다 — pois 자체를 비워
  // 넘기면 bounds 계산에도 반영돼 확대/축소가 같이 튀는 부작용이 생긴다.
  hideMarkers?: boolean;
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

// 좌표를 모두 담되, 여러 POI가 흩어져 있을 때 setBounds가 지나치게 축소해
// (지도 카드가 낮은 컨테이너에선 특히) 커스텀 마커가 카카오 기본 라벨(주유소·아파트 단지명 등)에
// 묻혀 안 보이는 걸 막기 위한 최대 레벨 상한. 시작 level(3)에서 두 단계까지만 축소 허용.
const MAX_FIT_LEVEL = 5;

// Map 내부에서 useMap()으로 인스턴스를 받아 bounds를 조정하는 컴포넌트
function BoundsAdjuster({ mainCoord, coords }: { mainCoord: Coord; coords: Coord[] }) {
  const map = useMap("BoundsAdjuster");

  // coords/mainCoord는 CourseMap이 렌더될 때마다(예: 마커 클릭으로 selectedPoiId만 바뀌어도)
  // 매번 새 배열·객체로 만들어진다. 참조로 비교하면 값이 그대로여도 매 렌더 이펙트가 재실행돼
  // 지도가 fit-bounds로 스냅백한다 — useCourseActive.ts의 coordKey 패턴과 동일하게 문자열 키로 비교한다.
  const coordsKey = coords.map((c) => `${c.lat},${c.lng}`).join("|");
  const mainCoordKey = `${mainCoord.lat},${mainCoord.lng}`;

  useEffect(() => {
    if (!coordsKey) return;

    const bounds = new kakao.maps.LatLngBounds();
    coordsKey.split("|").forEach((pair) => {
      const [lat, lng] = pair.split(",").map(Number);
      bounds.extend(new kakao.maps.LatLng(lat, lng));
    });
    map.setBounds(bounds, 40); // 40px padding — 지도 카드 높이가 낮아 60px는 과함

    // 현재 장소 기준으로 축소하되(현재 장소가 화면 중심에서 벗어나지 않도록),
    // 먼 POI 때문에 과도하게 축소되지 않게 상한을 둔다.
    if (map.getLevel() > MAX_FIT_LEVEL) {
      const [mLat, mLng] = mainCoordKey.split(",").map(Number);
      map.setLevel(MAX_FIT_LEVEL, {
        anchor: new kakao.maps.LatLng(mLat, mLng),
      });
    }
  }, [map, coordsKey, mainCoordKey]);

  return null;
}

export function CourseMap({
  mainPlace,
  pois = [],
  selectedPoiId,
  onSelectPoi,
  hideMarkers = false,
}: Props) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const kakao = (
      window as unknown as { kakao?: { maps?: { load: (cb: () => void) => void } } }
    ).kakao;
    kakao?.maps?.load(() => setLoaded(true));
  }, []);

  if (!loaded) return <CourseMapPlaceholder />;

  // 목록에서 하나를 선택하면 그 마커만 남기고 나머지는 숨긴다 —
  // 여러 핀이 섞여 있으면 지금 선택한 곳이 어디인지 지도만 보고는 알기 어렵기 때문.
  // bounds도 이 목록 기준으로 다시 잡혀 선택한 장소가 화면에 크게 보인다.
  const visiblePois = selectedPoiId
    ? pois.filter((p) => p.id === selectedPoiId)
    : pois;

  const allCoords: Coord[] = [
    mainPlace.coord,
    ...visiblePois.map((p) => p.coord).filter((c): c is Coord => !!(c?.lat && c?.lng)),
  ];

  // bounds(allCoords)는 위에서 이미 계산 끝 — hideMarkers는 렌더링에만 관여한다
  const renderedPois = hideMarkers ? [] : visiblePois;

  return (
    <div className="w-full h-full">
      <Map
        center={mainPlace.coord}
        style={{ width: "100%", height: "100%" }}
        level={3}
      >
        <BoundsAdjuster mainCoord={mainPlace.coord} coords={allCoords} />

        {/* 현재 장소 마커 — POI 핀이 몰려 있으면 카테고리 핀들 사이에 묻혀 안 보이던 문제.
            핀과는 다른 halo+dot 실루엣(형태로 구분) + 최상단 zIndex(겹쳐도 항상 위)로 해결한다. */}
        <MapMarker
          position={mainPlace.coord}
          image={{ src: MAIN_PLACE_MARKER_ICON, size: { width: 40, height: 40 } }}
          zIndex={999}
        />

        {/* POI 마커 — 클릭 또는 목록 탭 시 이름 표시 */}
        {renderedPois.map((poi) => (
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

// 현재 장소 마커 — halo(반투명 큰 원) + dot(흰 테두리 원)로, 카테고리 핀(물방울)과는
// 다른 실루엣이라 핀이 몰려 있어도 형태만으로 구분된다. secondary 토큰(라이트 테마 hex,
// 마커가 data URI라 CSS 변수를 못 받는 사정은 POI_MARKER_ICON과 동일) — accent/point/primary는
// 이미 카테고리 색으로 쓰이고 있어 현재 장소는 겹치지 않는 별도 색으로 뺐다.
function mainPlaceMarkerSvg(color: string) {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">`,
    `<circle cx="20" cy="20" r="18" fill="${color}" fill-opacity="0.18"/>`,
    `<circle cx="20" cy="20" r="10" fill="${color}" stroke="white" stroke-width="3"/>`,
    `</svg>`,
  ].join("");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const MAIN_PLACE_MARKER_ICON = mainPlaceMarkerSvg("#2e5f8a"); // secondary

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

// data URI로 렌더되는 마커는 문서의 CSS 변수를 상속받지 못해 테마 반응이 불가능하다 —
// 라이트 테마 토큰(app/globals.css)의 accent/point/primary 값을 고정 hex로 미러링해
// CourseActiveView 리스트 아이콘(CATEGORY_META)과 카테고리별 색을 맞춘다.
const POI_MARKER_ICON: Record<Exclude<import("@/shared/types/course.types").NearbyCategory, "all">, string> = {
  cafe:         pinMarkerSvg("#3d7a6b", ICON_PATHS.coffee),       // accent
  convenience:  pinMarkerSvg("#e8936a", ICON_PATHS.shoppingBag),  // point
  pharmacy:     pinMarkerSvg("#243b55", ICON_PATHS.plus),         // primary
  restaurant:   pinMarkerSvg("#F97316", ICON_PATHS.utensils),     // orange-500
  parking:      pinMarkerSvg("#0EA5E9", ICON_PATHS.squareParking),// sky-500
  gas_station:  pinMarkerSvg("#EAB308", ICON_PATHS.fuel),         // yellow-500
};
