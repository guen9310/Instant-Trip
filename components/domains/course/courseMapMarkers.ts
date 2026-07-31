import {
  POI_CATEGORY_COLOR,
  POI_CATEGORY_COLOR_DARK,
  type PoiCategory,
} from "@/shared/constants/poiCategory";

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

export const MAIN_PLACE_MARKER_ICON = mainPlaceMarkerSvg("#2e5f8a"); // secondary (light)
export const MAIN_PLACE_MARKER_ICON_DARK = mainPlaceMarkerSvg("#4a7aa8"); // secondary (.dark)

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
  pill:         `<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>`,
  utensils:     `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`,
  squareParking:`<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>`,
  fuel:         `<path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5"/><path d="M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16"/><path d="M2 21h13"/><path d="M3 9h11"/>`,
};

// data URI로 렌더되는 마커는 문서의 CSS 변수를 상속받지 못해 테마 반응이 불가능하다 —
// 대신 라이트·다크 색상 세트로 마커를 각각 미리 만들어두고, 컴포넌트에서 useIsDarkMode()
// 결과에 따라 어느 세트를 쓸지만 고른다(CourseMap의 markerIcons/mainPlaceMarkerIcon 참고). 색상은
// POI_CATEGORY_COLOR·POI_CATEGORY_COLOR_DARK(shared/constants/poiCategory.ts)가 단일
// 출처다 — 범례·CourseActiveView 리스트 아이콘과 동일.
export const POI_MARKER_ICON: Record<PoiCategory, string> = {
  cafe:         pinMarkerSvg(POI_CATEGORY_COLOR.cafe, ICON_PATHS.coffee),
  convenience:  pinMarkerSvg(POI_CATEGORY_COLOR.convenience, ICON_PATHS.shoppingBag),
  pharmacy:     pinMarkerSvg(POI_CATEGORY_COLOR.pharmacy, ICON_PATHS.pill),
  restaurant:   pinMarkerSvg(POI_CATEGORY_COLOR.restaurant, ICON_PATHS.utensils),
  parking:      pinMarkerSvg(POI_CATEGORY_COLOR.parking, ICON_PATHS.squareParking),
  gas_station:  pinMarkerSvg(POI_CATEGORY_COLOR.gas_station, ICON_PATHS.fuel),
};

export const POI_MARKER_ICON_DARK: Record<PoiCategory, string> = {
  cafe:         pinMarkerSvg(POI_CATEGORY_COLOR_DARK.cafe, ICON_PATHS.coffee),
  convenience:  pinMarkerSvg(POI_CATEGORY_COLOR_DARK.convenience, ICON_PATHS.shoppingBag),
  pharmacy:     pinMarkerSvg(POI_CATEGORY_COLOR_DARK.pharmacy, ICON_PATHS.pill),
  restaurant:   pinMarkerSvg(POI_CATEGORY_COLOR_DARK.restaurant, ICON_PATHS.utensils),
  parking:      pinMarkerSvg(POI_CATEGORY_COLOR_DARK.parking, ICON_PATHS.squareParking),
  gas_station:  pinMarkerSvg(POI_CATEGORY_COLOR_DARK.gas_station, ICON_PATHS.fuel),
};
