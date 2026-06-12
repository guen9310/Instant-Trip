const BASE_URL = "https://dapi.kakao.com/v2/local/search/category.json";
const REST_KEY = process.env.KAKAO_REST_KEY ?? "";

export const NEARBY_CATEGORIES = {
  음식점: "FD6",
  카페:   "CE7",
  편의점: "CS2",
  약국:   "PM9",
  주차장: "PK6",
  주유소: "OL7",
} as const;

export type NearbyCategoryKey = keyof typeof NEARBY_CATEGORIES;
export type NearbyCategoryCode = (typeof NEARBY_CATEGORIES)[NearbyCategoryKey];

export interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: string;
  category_group_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string;   // 경도
  y: string;   // 위도
  place_url: string;
  distance: string;  // 미터
}

async function fetchByCode(
  lat: number,
  lng: number,
  code: NearbyCategoryCode,
  radiusM: number,
): Promise<KakaoPlace[]> {
  const params = new URLSearchParams({
    category_group_code: code,
    x: String(lng),
    y: String(lat),
    radius: String(radiusM),
    sort: "distance",
    size: "15",
  });

  const res = await fetch(`${BASE_URL}?${params}`, {
    headers: { Authorization: `KakaoAK ${REST_KEY}` },
  });

  if (!res.ok) {
    throw new Error(`카카오 로컬 API 오류: ${res.status} ${await res.text()}`);
  }

  const data = await res.json() as { documents: KakaoPlace[] };
  return data.documents;
}

// 단일 카테고리 또는 전체(모든 카테고리 병렬 조회 후 거리순 합산)
export async function fetchNearby(
  lat: number,
  lng: number,
  categoryCode: NearbyCategoryCode | "ALL",
  radiusM = 500,
): Promise<KakaoPlace[]> {
  if (!REST_KEY) throw new Error("KAKAO_REST_KEY 환경변수가 설정되지 않았습니다.");

  if (categoryCode === "ALL") {
    const results = await Promise.all(
      (Object.values(NEARBY_CATEGORIES) as NearbyCategoryCode[]).map(
        (code) => fetchByCode(lat, lng, code, radiusM).catch(() => [] as KakaoPlace[]),
      ),
    );
    return results
      .flat()
      .sort((a, b) => parseInt(a.distance) - parseInt(b.distance));
  }

  return fetchByCode(lat, lng, categoryCode, radiusM);
}
