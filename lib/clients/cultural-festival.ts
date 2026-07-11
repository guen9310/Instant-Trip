/**
 * 공공데이터포털 — 전국문화축제표준데이터 클라이언트
 * API: https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api
 *
 * 시작일·종료일 필터로 현재 진행 중인 축제만 정확히 조회할 수 있다.
 */

const BASE_URL = "https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api";
const API_KEY = process.env.TOUR_API_KEY ?? "";

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
  if (!API_KEY) throw new Error("TOUR_API_KEY 환경변수가 설정되지 않았습니다.");

  const { pageNo = 1, numOfRows = 100 } = params;
  const data = await requestFestivals(API_KEY, pageNo, numOfRows);

  const raw = data.response.body.items;
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map((f) => ({
    ...f,
    latitude:  Number(f.latitude),
    longitude: Number(f.longitude),
  }));
}
