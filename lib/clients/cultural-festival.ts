/**
 * 공공데이터포털 — 전국문화축제표준데이터 클라이언트
 * API: https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api
 *
 * 시작일·종료일 필터로 현재 진행 중인 축제만 정확히 조회할 수 있다.
 */

const BASE_URL = "https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api";
// TourAPI(KorService2)와 같은 계정 키를 1차로 쓰지만, 이 API는 data.go.kr에서 별도
// 활용신청이 필요해 1차 키가 거부될 수 있다(2026-06-29 확인: "30 SERVICE KEY IS NOT
// REGISTERED ERROR"). 그 경우 대체 키로 1회 재시도한다 — 둘 중 하나만 살아있어도 동작한다.
const PRIMARY_KEY = process.env.TOUR_API_KEY ?? "";
const FALLBACK_KEY = process.env.CULTURAL_FESTIVAL_API_KEY_FALLBACK ?? "";

export interface CulturalFestival {
  fstvlNm: string;         // 축제명
  opar: string;            // 주최자
  fstvlStartDate: string;  // 시작일 (YYYY-MM-DD, 2026-06-29 확인 — 대시 포함)
  fstvlEndDate: string;    // 종료일 (YYYY-MM-DD)
  fstvlCo: string;         // 축제 내용
  mnnstNm: string;         // 주최기관
  auspcInsttNm: string;    // 주관기관
  suprtInsttNm: string;    // 후원기관
  phoneNumber: string;
  homepageUrl: string;
  relateInfo: string;      // 관련 정보
  rdnmadr: string;         // 도로명 주소
  lnmadr: string;          // 지번 주소
  latitude: number;        // 위도
  longitude: number;       // 경도
  referenceDate: string;   // 기준일자
  insttCode: string;
  insttNm: string;
}

type RawFestival = Omit<CulturalFestival, "latitude" | "longitude"> & {
  latitude: string;
  longitude: string;
};

interface GovApiResponse {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: {
      items: RawFestival[] | "";
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

async function requestFestivals(
  serviceKey: string,
  pageNo: number,
  numOfRows: number,
): Promise<GovApiResponse> {
  const query = new URLSearchParams({
    serviceKey,
    pageNo:    String(pageNo),
    numOfRows: String(numOfRows),
    type:      "json",
  });

  const res = await fetch(`${BASE_URL}?${query}`);
  if (!res.ok) throw new Error(`문화축제 API 오류: ${res.status} ${res.statusText}`);

  const data = await res.json() as GovApiResponse;
  const { resultCode, resultMsg } = data.response.header;
  if (resultCode !== "00") throw new Error(`문화축제 API 오류: ${resultCode} ${resultMsg}`);

  return data;
}

export async function fetchCulturalFestivals(params: {
  pageNo?: number;
  numOfRows?: number;
} = {}): Promise<CulturalFestival[]> {
  if (!PRIMARY_KEY && !FALLBACK_KEY) {
    throw new Error("TOUR_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const { pageNo = 1, numOfRows = 100 } = params;

  let data: GovApiResponse;
  try {
    if (!PRIMARY_KEY) throw new Error("TOUR_API_KEY 미설정");
    data = await requestFestivals(PRIMARY_KEY, pageNo, numOfRows);
  } catch (err) {
    if (!FALLBACK_KEY) throw err;
    console.warn(`[festival] 기본 키 거부 — 대체 키로 재시도 (${err})`);
    data = await requestFestivals(FALLBACK_KEY, pageNo, numOfRows);
  }

  const raw = data.response.body.items;
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map((f) => ({
    ...f,
    latitude:  Number(f.latitude),
    longitude: Number(f.longitude),
  }));
}
