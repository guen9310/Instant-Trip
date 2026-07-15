const BASE_URL = "https://dapi.kakao.com/v2/local/search/category.json";
const KEYWORD_BASE_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
const REST_KEY = process.env.KAKAO_REST_KEY ?? "";

export const NEARBY_CATEGORIES = {
  음식점: "FD6",
  카페: "CE7",
  편의점: "CS2",
  약국: "PM9",
  주차장: "PK6",
  주유소: "OL7",
} as const;

export type NearbyCategoryKey = keyof typeof NEARBY_CATEGORIES;
export type NearbyCategoryCode = (typeof NEARBY_CATEGORIES)[NearbyCategoryKey];

// 공원 키워드 검색 결과에서 제거할 카테고리 코드 (노이즈 필터)
const PARK_DROP_CODES = new Set([
  "FD6", "CE7", "PK6", "MT1", "CS2", "OL7",
  "BK9", "HP8", "PM9", "AD5", "AG2", "SC4",
  "AC5", "PS3", "SW8",
]);

export interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: string;
  category_group_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string; // 경도
  y: string; // 위도
  place_url: string;
  distance: string; // 미터
}

export type KakaoCourseCategoryCode = "AT4" | "CT1";

export interface KakaoPlaceTagged extends KakaoPlace {
  kakaoCategory: KakaoCourseCategoryCode;
}

export interface CourseKakaoResult {
  items: KakaoPlaceTagged[];
  // 중복 제거 전 원본 수집 건수 — 로깅용
  rawCounts: { at4Category: number; ct1Category: number; parkKeyword: number };
}

async function fetchByCode(
  lat: number,
  lng: number,
  code: string,
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

  const data = (await res.json()) as { documents: KakaoPlace[] };
  return data.documents;
}

async function fetchByKeyword(
  lat: number,
  lng: number,
  query: string,
  radiusM: number,
): Promise<KakaoPlace[]> {
  const params = new URLSearchParams({
    query,
    x: String(lng),
    y: String(lat),
    radius: String(radiusM),
    sort: "distance",
    size: "15",
  });

  const res = await fetch(`${KEYWORD_BASE_URL}?${params}`, {
    headers: { Authorization: `KakaoAK ${REST_KEY}` },
  });

  if (!res.ok) {
    throw new Error(`카카오 로컬 API 오류: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { documents: KakaoPlace[] };
  return data.documents;
}

// 공원 키워드 검색 — place_name이 "공원"으로 끝날 때만 통과 + 노이즈 카테고리 제거
// endsWith: "화봉공원 화장실", "대리공원앞교차로" 같은 노이즈를 차단하고
//           "화봉근린공원", "수변공원" 등 실제 공원만 남긴다
async function fetchParkKeyword(
  lat: number,
  lng: number,
  radiusM: number,
): Promise<KakaoPlace[]> {
  const places = await fetchByKeyword(lat, lng, "공원", radiusM);
  return places
    .filter((p) => p.place_name.trim().endsWith("공원"))
    .filter((p) => !PARK_DROP_CODES.has(p.category_group_code))
    .map((p) => ({ ...p, category_group_code: "AT4" }));
}

// 단일 카테고리 또는 전체(모든 카테고리 병렬 조회 후 거리순 합산)
export async function fetchNearby(
  lat: number,
  lng: number,
  categoryCode: NearbyCategoryCode | "ALL",
  radiusM = 500,
): Promise<KakaoPlace[]> {
  if (!REST_KEY)
    throw new Error("KAKAO_REST_KEY 환경변수가 설정되지 않았습니다.");

  if (categoryCode === "ALL") {
    const results = await Promise.all(
      (Object.values(NEARBY_CATEGORIES) as NearbyCategoryCode[]).map((code) =>
        fetchByCode(lat, lng, code, radiusM).catch(() => [] as KakaoPlace[]),
      ),
    );
    return results
      .flat()
      .sort((a, b) => parseInt(a.distance) - parseInt(b.distance));
  }

  return fetchByCode(lat, lng, categoryCode, radiusM);
}

// 코스 후보용 카카오 장소 수집: 공원류만 (키워드 "공원" 검색)
// AT4(관광명소)·CT1(문화시설) 카테고리 검색은 스파·레저·상업시설 등 비관광 장소가
// 혼입되어 코스 후보로 적합하지 않아 제외. 맛집 등 주변 연계 정보는 클라이언트에서 별도 조회.
export async function fetchCourseKakao(
  lat: number,
  lng: number,
  radiusM: number,
): Promise<CourseKakaoResult> {
  if (!REST_KEY)
    throw new Error("KAKAO_REST_KEY 환경변수가 설정되지 않았습니다.");

  const parks = await fetchParkKeyword(lat, lng, radiusM).catch(() => [] as KakaoPlace[]);
  const items: KakaoPlaceTagged[] = parks.map((p) => ({ ...p, kakaoCategory: "AT4" as const }));

  return {
    items,
    rawCounts: {
      at4Category: 0,
      ct1Category: 0,
      parkKeyword: parks.length,
    },
  };
}
