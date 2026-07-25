"use client";

import { useState, useEffect, useCallback } from "react";
import { Map, MapMarker, CustomOverlayMap, useMap } from "react-kakao-maps-sdk";
import {
  MapPin,
  Navigation,
  Palette,
  X,
  Coffee,
  ShoppingBag,
  Pill,
  Utensils,
  SquareParking,
  Fuel,
} from "lucide-react";
import type { NearbyPoi } from "@/shared/types/course.types";
import {
  POI_CATEGORY_COLOR,
  POI_CATEGORY_COLOR_DARK,
  POI_CATEGORY_LABEL,
  POI_CATEGORY_ORDER,
  type PoiCategory,
} from "@/shared/constants/poiCategory";
import { clusterPoints } from "@/shared/utils/clusterPoints";
import { cn } from "@/shared/utils";
import { useIsDarkMode } from "@/client/hooks/useIsDarkMode";

type Coord = { lat: number; lng: number };

type MapDisplayMode = "full" | "hidden";

// 클러스터로 묶을 화면 픽셀 거리 임계값 — 그리드가 아니라 실제 픽셀 거리 기준이라
// 격자 경계에 걸려 애매하게 나뉘는 케이스가 없다.
const CLUSTER_PIXEL_THRESHOLD = 40;
// 배지 하나가 담을 수 있는 최대 멤버 수 — 이 이상 뭉치면 "58개가 배지 하나"처럼
// 정보 과밀 해소라는 목적과 충돌하므로, 넘으면 배지를 여러 개로 자동 분할한다.
const MAX_CLUSTER_SIZE = 8;
// 배지 클릭 시 이 개수 이하면 인라인 목록으로 개별 선택, 초과하면 줌인.
const INLINE_LIST_MAX = 4;

type PoiClusterState = { key: string; memberIds: string[]; centerCoord: Coord };

// 현재 지도 뷰포트 경계를 부모에게 알려주는 헬퍼 — 부모(NearbyPanel)가 이걸로 하단
// 리스트를 "지금 지도 화면에 실제로 보이는 장소"만 남기게 좁힌다.
function reportViewport(
  map: kakao.maps.Map,
  onViewportChange?: (bounds: { sw: Coord; ne: Coord } | null) => void,
) {
  if (!onViewportChange) return;
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  onViewportChange({
    sw: { lat: sw.getLat(), lng: sw.getLng() },
    ne: { lat: ne.getLat(), lng: ne.getLng() },
  });
}

const DISPLAY_MODE_SEGMENTS: { id: MapDisplayMode; label: string }[] = [
  { id: "full", label: "전체" },
  { id: "hidden", label: "숨김" },
];

// 길찾기 컨텍스트 스트립·버튼 아이콘 — CourseActiveView의 CATEGORY_META와 동일한
// 카테고리↔아이콘 매핑(단일 출처는 아니지만 같은 선택을 따름, POI_MARKER_ICON의
// ICON_PATHS도 이미 같은 아이콘을 별도로 인라인 SVG화해 쓰고 있는 것과 같은 사정).
const POI_CATEGORY_ICON: Record<
  PoiCategory,
  React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; color?: string }>
> = {
  cafe: Coffee,
  convenience: ShoppingBag,
  pharmacy: Pill,
  restaurant: Utensils,
  parking: SquareParking,
  gas_station: Fuel,
};

function StripCategoryIcon({ poi, color }: { poi: NearbyPoi; color: string }) {
  const Icon = POI_CATEGORY_ICON[poi.category];
  return <Icon size={12} strokeWidth={2.2} className="shrink-0" color={color} />;
}

type Props = {
  mainPlace: { name: string; coord: Coord };
  pois?: NearbyPoi[];
  selectedPoiId?: string | null;
  onSelectPoi?: (id: string | null) => void;
  // 현재 지도 뷰포트 경계를 부모(NearbyPanel)로 올린다 — 하단 리스트를 지도에
  // 실제로 보이는 장소만으로 좁혀서 지도·리스트가 항상 같은 내용을 보여주게 한다.
  onViewportChange?: (bounds: { sw: Coord; ne: Coord } | null) => void;
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
        <span className="text-[11px] font-semibold">현재 장소</span>
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
  pois: poisProp,
  selectedPoiId,
  onSelectPoi,
  onViewportChange,
}: Props) {
  const pois = poisProp ?? [];
  // 카드 전체(지도+툴바+범례+길찾기)를 이 컴포넌트가 소유하는 "풀 모드"인지 판별하는 기준.
  // pois.length가 아니라 prop이 "전달됐는지"로 본다 — CourseResultView는 pois를 아예 안 넘기고
  // (bare 모드 유지), NearbyPanel은 필터링으로 진짜 빈 배열이 될 때도 있어(예: "주변에 표시할
  // 장소가 없어요") 배열 길이로 판별하면 그 상태에서 카드 높이 지정 자체가 사라져버린다.
  const isFullMode = poisProp !== undefined;

  const [loaded, setLoaded] = useState(false);
  const [displayMode, setDisplayMode] = useState<MapDisplayMode>("full");
  const [legendOpen, setLegendOpen] = useState(false);
  const [mapInstance, setMapInstance] = useState<kakao.maps.Map | null>(null);
  const [clusters, setClusters] = useState<PoiClusterState[]>([]);
  const [openClusterKey, setOpenClusterKey] = useState<string | null>(null);
  const isDark = useIsDarkMode();
  // 범례·컨텍스트 스트립·길찾기 버튼·클러스터 배지처럼 실제 DOM으로 그려지는 요소는
  // 라이트/다크 테마에 맞는 색을 골라 쓸 수 있다(데이터 URI인 마커 아이콘만 아래
  // markerIcons/mainPlaceMarkerIcon처럼 별도로 미리 생성해둔 세트를 선택해야 한다).
  const categoryColor = isDark ? POI_CATEGORY_COLOR_DARK : POI_CATEGORY_COLOR;
  const markerIcons = isDark ? POI_MARKER_ICON_DARK : POI_MARKER_ICON;
  const mainPlaceMarkerIcon = isDark ? MAIN_PLACE_MARKER_ICON_DARK : MAIN_PLACE_MARKER_ICON;

  useEffect(() => {
    const kakao = (
      window as unknown as { kakao?: { maps?: { load: (cb: () => void) => void } } }
    ).kakao;
    kakao?.maps?.load(() => setLoaded(true));
  }, []);

  // 클러스터링 대상 — "숨김" 모드에서는 아무것도 안 보여준다. selectedPoiId는
  // 더 이상 이 목록을 좁히지 않는다: 예전엔 선택 시 핀을 선택된 것 하나로 줄이고
  // bounds도 그 기준으로 다시 잡았는데, 그러면 선택을 취소할 때마다 사용자가 잡아둔
  // 줌이 초기화됐다("확대해서 핀 하나를 골랐는데 취소하니 다시 전체 보기로 돌아감").
  // 이제 선택된 장소는 클러스터링에서 제외하고 아래에서 항상 강조 마커로 별도로
  // 그린다 — 나머지 핀은 그대로 두고 지도 화면(줌·팬)도 건드리지 않는다.
  const clusterInputPois = (displayMode === "hidden" ? [] : pois).filter(
    (p) => p.id !== selectedPoiId,
  );

  // 클러스터 재계산 트리거 — BoundsAdjuster와 동일하게 배열 참조가 아니라 문자열 키로
  // 변경을 감지한다(매 렌더 새 배열이 생겨도 값이 같으면 이펙트가 재실행되지 않도록).
  const renderedPoisKey = clusterInputPois
    .map((p) => `${p.id}:${p.coord.lat},${p.coord.lng}`)
    .join("|");

  useEffect(() => {
    if (!mapInstance) return;

    const recompute = () => {
      const projection = mapInstance.getProjection();
      const points = renderedPoisKey
        .split("|")
        .filter(Boolean)
        .map((entry) => {
          const [id, latlng] = entry.split(":");
          const [lat, lng] = latlng.split(",").map(Number);
          const pt = projection.pointFromCoords(new kakao.maps.LatLng(lat, lng));
          return { id, x: pt.x, y: pt.y };
        });
      const grouped = clusterPoints(points, {
        thresholdPx: CLUSTER_PIXEL_THRESHOLD,
        maxSize: MAX_CLUSTER_SIZE,
      });
      const next = grouped.map((g) => {
        const cx = g.members.reduce((s, m) => s + m.x, 0) / g.members.length;
        const cy = g.members.reduce((s, m) => s + m.y, 0) / g.members.length;
        const centerLatLng = projection.coordsFromPoint(new kakao.maps.Point(cx, cy));
        return {
          key: g.key,
          memberIds: g.members.map((m) => m.id),
          centerCoord: { lat: centerLatLng.getLat(), lng: centerLatLng.getLng() },
        };
      });
      setClusters(next);
      // 재클러스터링 후 더 이상 존재하지 않는 클러스터 키를 팝오버로 열어둔 채 남기지 않는다.
      setOpenClusterKey((prev) => (prev && next.some((c) => c.key === prev) ? prev : null));
    };

    recompute();
    kakao.maps.event.addListener(mapInstance, "idle", recompute);
    return () => kakao.maps.event.removeListener(mapInstance, "idle", recompute);
  }, [mapInstance, renderedPoisKey]);

  // mapInstance가 준비되는 즉시(최초 1회) 뷰포트를 한 번 보고한다 — 이후 팬/줌에 의한
  // 갱신은 <Map onBoundsChanged>가 담당.
  // onCreate prop에 인라인 함수를 넘기면 SDK의 onCreate 이펙트가 매 렌더 재실행돼 무한
  // 렌더 루프가 생기므로, onCreate는 안정적인 setMapInstance 그대로 두고 별도 이펙트로 분리했다.
  useEffect(() => {
    if (!mapInstance) return;
    reportViewport(mapInstance, onViewportChange);
  }, [mapInstance, onViewportChange]);

  // bounds_changed 콜백을 useCallback으로 고정 — react-kakao-maps-sdk의 useKakaoEvent는
  // 콜백 참조가 바뀔 때마다 리스너를 addListener/removeListener로 재등록한다. 인라인 함수를
  // 그대로 넘기면 매 렌더 재등록될 뿐 아니라, 위 onCreate 사례처럼 상태를 갱신하는 콜백이면
  // 무한 루프로 이어질 수 있어 항상 메모이즈해서 넘긴다.
  const handleBoundsChanged = useCallback(
    (map: kakao.maps.Map) => reportViewport(map, onViewportChange),
    [onViewportChange],
  );
  const handleMapClick = useCallback(() => setOpenClusterKey(null), []);

  if (!loaded) return <CourseMapPlaceholder />;

  // 카테고리 필터(pois)가 바뀔 때만 다시 fit한다 — selectedPoiId는 더 이상 관여하지
  // 않으므로 장소를 선택·해제해도 지도 줌·팬은 그대로 유지된다.
  const allCoords: Coord[] = [
    mainPlace.coord,
    ...pois.map((p) => p.coord).filter((c): c is Coord => !!(c?.lat && c?.lng)),
  ];

  // 클러스터 배지 클릭 — 멤버가 적으면 인라인 목록을 토글, 많으면 해당 클러스터
  // bounds로 확대(BoundsAdjuster가 쓰는 것과 동일한 setBounds API). 확대가 끝나면
  // idle 이벤트로 재계산되어 더 잘게 쪼개진 클러스터·개별 핀이 드러난다.
  const handleClusterClick = (cluster: PoiClusterState, members: NearbyPoi[]) => {
    if (members.length <= INLINE_LIST_MAX) {
      setOpenClusterKey((prev) => (prev === cluster.key ? null : cluster.key));
      return;
    }
    if (!mapInstance) return;
    const bounds = new kakao.maps.LatLngBounds();
    members.forEach((m) => bounds.extend(new kakao.maps.LatLng(m.coord.lat, m.coord.lng)));
    mapInstance.setBounds(bounds, 40);
  };

  // 범례 — 필터 칩으로 카테고리를 좁혀도 항상 6개 전부 보여준다. pois에 실제로 있는
  // 카테고리만 추리면 필터링·POI 선택할 때마다 범례가 줄었다 늘었다 해서 색 기준표 역할을
  // 못 하게 된다("이 색이 무슨 카테고리였지" 확인하려는 시점에 정작 안 보일 수 있음).
  const legendCategories = POI_CATEGORY_ORDER;

  // 길찾기 대상 — 목록에서 선택 중인 POI가 있으면 그곳으로, 아니면 현재 장소로.
  // NearbyPoi.coord는 필수 필드라 별도 null 체크가 필요 없다.
  const selectedPoi = selectedPoiId ? pois.find((p) => p.id === selectedPoiId) : undefined;
  const directionsTarget = selectedPoi ?? mainPlace;

  // 지도 자체(마커)는 bare/full 두 모드에서 완전히 동일 — 감싸는 컨테이너 크기(h-full vs
  // h-72)만 다르므로 한 번만 만들어 양쪽에서 재사용한다.
  const mapElement = (
    <Map
      center={mainPlace.coord}
      style={{ width: "100%", height: "100%" }}
      level={3}
      onCreate={setMapInstance}
      onBoundsChanged={handleBoundsChanged}
      onClick={handleMapClick}
    >
      <BoundsAdjuster mainCoord={mainPlace.coord} coords={allCoords} />

      {/* 현재 장소 마커 — POI 핀이 몰려 있으면 카테고리 핀들 사이에 묻혀 안 보이던 문제.
          핀과는 다른 halo+dot 실루엣(형태로 구분) + 최상단 zIndex(겹쳐도 항상 위)로 해결한다. */}
      <MapMarker
        position={mainPlace.coord}
        image={{ src: mainPlaceMarkerIcon, size: { width: 40, height: 40 } }}
        zIndex={999}
      />

      {/* POI 마커 — 픽셀 거리 기준으로 묶은 클러스터(선택된 장소는 제외하고 계산됨).
          멤버가 1개면 기존과 동일한 개별 핀, 2개 이상이면 배지(ClusterBadge)로 그린다. */}
      {clusters.map((cluster) => {
        const members = cluster.memberIds
          .map((id) => clusterInputPois.find((p) => p.id === id))
          .filter((p): p is NearbyPoi => !!p);
        if (members.length === 0) return null;

        if (members.length === 1) {
          const poi = members[0];
          return (
            <MapMarker
              key={cluster.key}
              position={poi.coord}
              image={{
                src: markerIcons[poi.category],
                size: { width: 28, height: 36 },
              }}
              onClick={() => onSelectPoi?.(poi.id)}
            />
          );
        }

        return (
          <CustomOverlayMap
            key={cluster.key}
            position={cluster.centerCoord}
            clickable
            zIndex={100}
          >
            <ClusterBadge
              members={members}
              categoryColor={categoryColor}
              isOpen={openClusterKey === cluster.key}
              onToggle={() => handleClusterClick(cluster, members)}
              onSelectMember={(id) => {
                onSelectPoi?.(id);
                setOpenClusterKey(null);
              }}
            />
          </CustomOverlayMap>
        );
      })}

      {/* 선택된 장소 — displayMode·클러스터링과 무관하게 항상 강조 마커로 별도로
          그린다("숨김" 모드여도 선택 중인 곳은 보여준다는 기존 동작 유지). 클러스터
          안에 숨어버리지 않도록 위에서 클러스터링 대상에서 제외해뒀다. 일반 핀보다
          살짝 크고 zIndex도 높아 다른 핀·배지에 가려지지 않는다. */}
      {selectedPoi && (
        <MapMarker
          position={selectedPoi.coord}
          image={{
            src: markerIcons[selectedPoi.category],
            size: { width: 34, height: 44 },
          }}
          zIndex={500}
          onClick={() => onSelectPoi?.(null)}
        />
      )}
    </Map>
  );

  // CourseResultView처럼 pois를 아예 안 넘기는 "bare" 모드 — 지도만 채우고 카드 chrome·툴바
  // 없이 부모가 준 컨테이너(h-45 등)를 그대로 채운다. 지금까지의 동작과 동일.
  if (!isFullMode) {
    return <div className="relative w-full h-full">{mapElement}</div>;
  }

  // NearbyPanel의 "풀" 모드 — 카드(radius·border·overflow)와 지도 아래 컨트롤 툴바까지
  // 이 컴포넌트가 전부 소유한다. 지도 위에는 더 이상 아무것도 띄우지 않는다.
  return (
    <div className="w-full rounded-xl border border-border overflow-hidden bg-card">
      <div className="relative w-full h-72">{mapElement}</div>

      {/* 길찾기 목적지 컨텍스트 스트립 — 장소를 선택하면 길찾기 버튼의 목적지가 조용히
          바뀌는데, 버튼만 봐서는 어디로 연결되는지 알 수 없던 문제. 선택된 장소의
          카테고리 색·아이콘으로 목적지 이름을 명시하고, 아래 길찾기 버튼도 같은
          색으로 맞춰 한눈에 "지금 다른 곳이 목적지"임을 알 수 있게 한다. */}
      {selectedPoi && (
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 border-t border-border"
          style={{ backgroundColor: `${categoryColor[selectedPoi.category]}14` }}
        >
          <StripCategoryIcon poi={selectedPoi} color={categoryColor[selectedPoi.category]} />
          <span
            className="flex-1 min-w-0 truncate text-[11px] font-bold"
            style={{ color: categoryColor[selectedPoi.category] }}
          >
            {selectedPoi.name}으로 길찾기
          </span>
          <button
            type="button"
            onClick={() => onSelectPoi?.(null)}
            className="shrink-0 text-text-secondary p-0.5"
          >
            <X size={12} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* 컨트롤 툴바 — 세그먼트 / 범례 토글 / 길찾기. 더 이상 지도 위에 떠 있지 않고 지도
          아래 일반 문서 흐름이라 z-index/stacking-context 대응이 필요 없다. */}
      <div className="flex items-center gap-2 p-2.5 border-t border-border">
        {pois.length > 0 && (
          <div className="flex items-center gap-0.5 p-0.75 rounded-full bg-background shrink-0">
            {DISPLAY_MODE_SEGMENTS.map((seg) => (
              <button
                key={seg.id}
                type="button"
                onClick={() => setDisplayMode(seg.id)}
                className={cn(
                  "h-6.5 px-2.75 rounded-full text-[12px] font-semibold transition-colors active:scale-95",
                  displayMode === seg.id
                    ? "bg-primary text-background"
                    : "text-text-secondary",
                )}
              >
                {seg.label}
              </button>
            ))}
          </div>
        )}

        {pois.length > 0 && displayMode !== "hidden" && (
          <button
            type="button"
            onClick={() => setLegendOpen((v) => !v)}
            className="w-8.5 h-8.5 rounded-full bg-background flex items-center justify-center shrink-0 active:scale-95 transition-transform"
          >
            <Palette size={16} strokeWidth={2} />
          </button>
        )}

        <div className="flex-1" />

        {/* 카카오맵 길찾기 — 현재 위치 → 선택한 장소(없으면 현재 장소)로의 경로를 새 탭에서 연다.
            선택된 장소가 있으면 버튼 색·아이콘을 그 카테고리로 맞춰(위 컨텍스트 스트립과 같은
            색) "지금 다른 곳이 목적지"임을 스트립과 버튼 두 군데서 함께 알려준다. */}
        <a
          href={`https://map.kakao.com/link/map/${encodeURIComponent(directionsTarget.name)},${directionsTarget.coord.lat},${directionsTarget.coord.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-1.5 h-8.5 px-3.5 rounded-full text-background text-[12px] font-semibold active:scale-95 transition-transform shrink-0",
            !selectedPoi && "bg-primary",
          )}
          style={
            selectedPoi
              ? {
                  backgroundColor: categoryColor[selectedPoi.category],
                  boxShadow: `0 0 0 3px ${categoryColor[selectedPoi.category]}2e`,
                }
              : undefined
          }
        >
          {(() => {
            const DirectionsIcon = selectedPoi ? POI_CATEGORY_ICON[selectedPoi.category] : Navigation;
            // 버튼 배경이 이미 카테고리 색이라 아이콘은 흰색(text-background 상속) 그대로 —
            // 카테고리 색을 또 입히면 배경과 아이콘이 같은 색이 되어 안 보인다.
            return <DirectionsIcon size={13} strokeWidth={2.2} />;
          })()}
          길찾기
        </a>
      </div>

      {/* 카테고리 범례 — 툴바의 팔레트 버튼으로 펼침/접힘. 필터 칩으로 카테고리를 좁혀도
          항상 6개 전부 보여준다(색 기준표 역할이라 필터와 무관해야 함). */}
      {legendOpen && pois.length > 0 && displayMode !== "hidden" && (
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-1.5 p-2.5 border-t border-border">
          {legendCategories.map((c) => (
            <div key={c} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: categoryColor[c] }}
              />
              <span className="text-[12px] font-medium text-text-primary">
                {POI_CATEGORY_LABEL[c]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 클러스터 배지 — 멤버 카테고리가 전부 같으면 그 카테고리 색(POI_CATEGORY_COLOR, 범례·
// 개별 핀과 동일 출처), 섞여 있으면 중립색. CustomOverlayMap은 데이터 URI 마커와 달리
// 실제 DOM이라 text-secondary 테마 토큰 클래스를 그대로 쓸 수 있어 라이트/다크 양쪽에
// 자동 대응된다(개별 핀의 hex 고정값 제약이 배지에는 적용되지 않음).
// isOpen이면 배지 아래에 인라인 목록을 펼쳐 개별 장소를 바로 선택할 수 있게 한다 —
// 부채꼴 펼치기 대신 이 방식을 택해 상태 관리를 단순하게 유지한다.
function ClusterBadge({
  members,
  categoryColor,
  isOpen,
  onToggle,
  onSelectMember,
}: {
  members: NearbyPoi[];
  categoryColor: Record<PoiCategory, string>;
  isOpen: boolean;
  onToggle: () => void;
  onSelectMember: (id: string) => void;
}) {
  const categories = new Set(members.map((m) => m.category));
  const uniformCategory = categories.size === 1 ? members[0].category : null;

  return (
    <div className="relative flex flex-col items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white shadow-md ring-2 ring-white active:scale-95 transition-transform bg-text-secondary"
        style={uniformCategory ? { backgroundColor: categoryColor[uniformCategory] } : undefined}
      >
        {members.length}
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 w-44 rounded-lg border border-border bg-card shadow-lg overflow-hidden z-10">
          {members.map((poi) => (
            <button
              key={poi.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectMember(poi.id);
              }}
              className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 hover:bg-background transition-colors"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: categoryColor[poi.category] }}
              />
              <span className="flex-1 min-w-0 text-[12px] font-medium text-text-primary truncate">
                {poi.name}
              </span>
              <span className="text-[10px] text-text-secondary shrink-0">{poi.dist}</span>
            </button>
          ))}
        </div>
      )}
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

const MAIN_PLACE_MARKER_ICON = mainPlaceMarkerSvg("#2e5f8a"); // secondary (light)
const MAIN_PLACE_MARKER_ICON_DARK = mainPlaceMarkerSvg("#4a7aa8"); // secondary (.dark)

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
// 결과에 따라 어느 세트를 쓸지만 고른다(markerIcons/mainPlaceMarkerIcon 참고). 색상은
// POI_CATEGORY_COLOR·POI_CATEGORY_COLOR_DARK(shared/constants/poiCategory.ts)가 단일
// 출처다 — 범례·CourseActiveView 리스트 아이콘과 동일.
const POI_MARKER_ICON: Record<PoiCategory, string> = {
  cafe:         pinMarkerSvg(POI_CATEGORY_COLOR.cafe, ICON_PATHS.coffee),
  convenience:  pinMarkerSvg(POI_CATEGORY_COLOR.convenience, ICON_PATHS.shoppingBag),
  pharmacy:     pinMarkerSvg(POI_CATEGORY_COLOR.pharmacy, ICON_PATHS.pill),
  restaurant:   pinMarkerSvg(POI_CATEGORY_COLOR.restaurant, ICON_PATHS.utensils),
  parking:      pinMarkerSvg(POI_CATEGORY_COLOR.parking, ICON_PATHS.squareParking),
  gas_station:  pinMarkerSvg(POI_CATEGORY_COLOR.gas_station, ICON_PATHS.fuel),
};

const POI_MARKER_ICON_DARK: Record<PoiCategory, string> = {
  cafe:         pinMarkerSvg(POI_CATEGORY_COLOR_DARK.cafe, ICON_PATHS.coffee),
  convenience:  pinMarkerSvg(POI_CATEGORY_COLOR_DARK.convenience, ICON_PATHS.shoppingBag),
  pharmacy:     pinMarkerSvg(POI_CATEGORY_COLOR_DARK.pharmacy, ICON_PATHS.pill),
  restaurant:   pinMarkerSvg(POI_CATEGORY_COLOR_DARK.restaurant, ICON_PATHS.utensils),
  parking:      pinMarkerSvg(POI_CATEGORY_COLOR_DARK.parking, ICON_PATHS.squareParking),
  gas_station:  pinMarkerSvg(POI_CATEGORY_COLOR_DARK.gas_station, ICON_PATHS.fuel),
};
