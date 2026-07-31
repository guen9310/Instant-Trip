import { useEffect } from "react";
import { useMap } from "react-kakao-maps-sdk";

type Coord = { lat: number; lng: number };

// 좌표를 모두 담되, 여러 POI가 흩어져 있을 때 setBounds가 지나치게 축소해
// (지도 카드가 낮은 컨테이너에선 특히) 커스텀 마커가 카카오 기본 라벨(주유소·아파트 단지명 등)에
// 묻혀 안 보이는 걸 막기 위한 최대 레벨 상한. 시작 level(3)에서 두 단계까지만 축소 허용.
const MAX_FIT_LEVEL = 5;

// Map 내부에서 useMap()으로 인스턴스를 받아 bounds를 조정하는 컴포넌트
export function BoundsAdjuster({ mainCoord, coords }: { mainCoord: Coord; coords: Coord[] }) {
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
