import type { AreaCode } from "@/lib/tour/types";

export type Region = {
  name: string;
  areaCode: AreaCode;
  // 시청/도청 좌표 — 위치 권한 거부 시 폴백용 대표 중심점
  // 출처: 네이버 지도 + 카카오맵 교차 확인 (2026-07-12)
  lat: number;
  lng: number;
};

// 17개 시·도 — 시청/도청 소재지 좌표 기준
export const REGIONS: Region[] = [
  { name: "서울", areaCode: "1",  lat: 37.5663, lng: 126.9779 }, // 서울특별시청
  { name: "인천", areaCode: "2",  lat: 37.4563, lng: 126.7052 }, // 인천광역시청
  { name: "대전", areaCode: "3",  lat: 36.3504, lng: 127.3845 }, // 대전광역시청
  { name: "대구", areaCode: "4",  lat: 35.8714, lng: 128.6014 }, // 대구광역시청
  { name: "광주", areaCode: "5",  lat: 35.1595, lng: 126.8526 }, // 광주광역시청
  { name: "부산", areaCode: "6",  lat: 35.1796, lng: 129.0756 }, // 부산광역시청
  { name: "울산", areaCode: "7",  lat: 35.5384, lng: 129.3114 }, // 울산광역시청
  { name: "세종", areaCode: "8",  lat: 36.4800, lng: 127.2890 }, // 세종특별자치시청
  { name: "경기", areaCode: "31", lat: 37.2636, lng: 127.0286 }, // 경기도청 (수원)
  { name: "강원", areaCode: "32", lat: 37.8813, lng: 127.7298 }, // 강원특별자치도청 (춘천)
  { name: "충북", areaCode: "33", lat: 36.6424, lng: 127.4890 }, // 충청북도청 (청주)
  { name: "충남", areaCode: "34", lat: 36.6010, lng: 126.6610 }, // 충청남도청 (홍성)
  { name: "경북", areaCode: "35", lat: 36.5684, lng: 128.7294 }, // 경상북도청 (안동)
  { name: "경남", areaCode: "36", lat: 35.2278, lng: 128.6811 }, // 경상남도청 (창원)
  { name: "전북", areaCode: "37", lat: 35.8242, lng: 127.1480 }, // 전북특별자치도청 (전주)
  { name: "전남", areaCode: "38", lat: 34.9062, lng: 126.5019 }, // 전라남도청 (무안)
  { name: "제주", areaCode: "39", lat: 33.4996, lng: 126.5312 }, // 제주특별자치도청
];

// 명칭 변형 → 표준 이름 맵
// Nominatim이 Accept-Language: ko 로 반환하는 state/city 필드 변형 + 영문 변형 포함
const ALIASES: Record<string, string> = {
  서울특별시: "서울", Seoul: "서울",
  인천광역시: "인천", Incheon: "인천",
  대전광역시: "대전", Daejeon: "대전",
  대구광역시: "대구", Daegu: "대구",
  광주광역시: "광주", Gwangju: "광주",
  부산광역시: "부산", Busan: "부산", Pusan: "부산",
  울산광역시: "울산", Ulsan: "울산",
  세종특별자치시: "세종", Sejong: "세종",
  경기도: "경기", Gyeonggi: "경기", "Gyeonggi-do": "경기",
  강원도: "강원", 강원특별자치도: "강원", Gangwon: "강원", "Gangwon-do": "강원",
  충청북도: "충북", Chungbuk: "충북", "Chungcheongbuk-do": "충북",
  충청남도: "충남", Chungnam: "충남", "Chungcheongnam-do": "충남",
  경상북도: "경북", Gyeongbuk: "경북", "Gyeongsangbuk-do": "경북",
  경상남도: "경남", Gyeongnam: "경남", "Gyeongsangnam-do": "경남",
  전라북도: "전북", 전북특별자치도: "전북", Jeonbuk: "전북", "Jeollabuk-do": "전북",
  전라남도: "전남", Jeonnam: "전남", "Jeollanam-do": "전남",
  제주도: "제주", 제주특별자치도: "제주", Jeju: "제주", "Jeju-do": "제주",
};

const REGION_BY_NAME = new Map<string, Region>(REGIONS.map((r) => [r.name, r]));

export function resolveRegion(cityName: string): Region | null {
  const s = cityName.trim();
  // 1. 표준 이름 직접 매칭 (서울, 부산, ...)
  const direct = REGION_BY_NAME.get(s);
  if (direct) return direct;
  // 2. 별칭 매칭 (서울특별시, Busan, ...)
  const canonical = ALIASES[s];
  if (canonical) return REGION_BY_NAME.get(canonical) ?? null;
  // 3. 표준 이름 포함 여부 — 입력이 "경상남도 창원시" 같은 복합 문자열일 때 대비
  for (const region of REGIONS) {
    if (s.includes(region.name)) return region;
  }
  return null;
}
