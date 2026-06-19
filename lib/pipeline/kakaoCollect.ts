import type { TourItem } from "@/lib/tour/types";
import { fetchCourseKakao } from "@/lib/clients/kakao-local";
import type { KakaoPlaceTagged } from "@/lib/clients/kakao-local";

function normalizeKakaoPlace(place: KakaoPlaceTagged): TourItem {
  // contenttypeid: CT1(문화시설) → "14", AT4(관광명소) → "12"
  const contenttypeid = place.kakaoCategory === "CT1" ? "14" : "12";

  return {
    contentid: `kakao_${place.id}`,
    contenttypeid,
    title: place.place_name,
    addr1: place.address_name,
    addr2: "",
    mapx: place.x,
    mapy: place.y,
    firstimage: "",
    firstimage2: "",
    cat1: "",
    cat2: "",
    cat3: "",
    areacode: "",
    sigungucode: "",
    createdtime: "",
    modifiedtime: "",
    tel: place.phone ?? "",
    source: "kakao",
    kakaoCategory: place.kakaoCategory,
    // lclsSystm은 위조하지 않는다 — 태그/체류시간은 kakaoCategory로만 부여
  };
}

export async function collectKakaoCandidates(
  lat: number,
  lng: number,
  radiusM: number,
): Promise<TourItem[]> {
  console.log(`[kakao] 카카오 코스 후보 수집 시작 — 위치 (${lat}, ${lng}), 반경 ${radiusM}m`);
  const t0 = Date.now();

  const places = await fetchCourseKakao(lat, lng, radiusM);
  const items = places.map(normalizeKakaoPlace);

  const at4Count = items.filter((i) => i.kakaoCategory === "AT4").length;
  const ct1Count = items.filter((i) => i.kakaoCategory === "CT1").length;
  console.log(
    `[kakao] 수집 완료 — AT4:${at4Count}건 CT1:${ct1Count}건 합계:${items.length}건 (${Date.now() - t0}ms)`,
  );

  return items;
}
