"use server";

import { resolveRegion } from "@/lib/tour/regionMap";

export type GeocodedCity = {
  displayName: string;  // 화면 표시용 — "울산 북구"처럼 시·도 축약형 + 읍/면/동 수준 이름
  sidoName: string | null; // resolveRegion에 넣을 시·도 레벨 이름 (원문, 예: "울산광역시")
};

const VWORLD_KEY = process.env.VWORLD_KEY ?? "";

// 국토교통부 브이월드 지오코더 응답 구조 — 실제 API 호출(서울/세종/군 단위 좌표)로
// 검증 완료. level1=시도, level2=시군구(세종처럼 구가 없으면 빈 문자열), level4A=행정동
// (parcel/road 응답 모두에 동일하게 채워짐 — 두 타입 중 뭘 골라도 결과는 같다).
type VWorldStructure = {
  level1?: string; // 시도
  level2?: string; // 시군구
  level3?: string; // road 응답의 읍·면·동 (parcel 응답에선 대개 빈 문자열)
  level4A?: string; // 행정읍·면·동 — parcel/road 응답 공통으로 채워진다
};

type VWorldResultItem = {
  type: "road" | "parcel"; // API 응답값은 소문자
  text: string;
  structure: VWorldStructure;
};

type VWorldResponse = {
  response: {
    status: "OK" | "NOT_FOUND" | "ERROR";
    result?: VWorldResultItem[];
  };
};

export async function fetchCityAction(
  lat: number,
  lon: number,
): Promise<GeocodedCity> {
  if (!VWORLD_KEY) {
    console.log("[geocode] VWORLD_KEY 없음 — 지오코딩 스킵");
    return { displayName: "현재 위치", sidoName: null };
  }

  // point는 "경도,위도"(x,y) 순서 — lat/lon을 바꿔 넣으면 조용히 엉뚱한 위치로 조회된다.
  const url =
    "https://api.vworld.kr/req/address?service=address&request=GetAddress" +
    `&key=${VWORLD_KEY}&point=${lon},${lat}&crs=EPSG:4326&type=BOTH&format=json`;

  const FALLBACK: GeocodedCity = { displayName: "현재 위치", sidoName: null };

  let res: Response;
  try {
    // VWorld가 응답을 지연시키면 getCurrentPosition의 10초 타임아웃과 별개로
    // 이 fetch 자체가 무한 대기할 수 있으므로 별도 타임아웃을 둔다.
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (err) {
    console.log("[geocode] fetch 실패:", err);
    return FALLBACK;
  }

  if (!res.ok) {
    console.log("[geocode] HTTP error:", res.status, res.statusText);
    return FALLBACK;
  }

  let data: VWorldResponse;
  try {
    data = await res.json();
  } catch (err) {
    console.log("[geocode] JSON 파싱 실패:", err);
    return FALLBACK;
  }

  if (data.response?.status !== "OK" || !data.response.result?.length) {
    console.log("[geocode] status:", data.response?.status);
    return FALLBACK;
  }

  // road 결과를 우선하고 없으면 parcel로 대체 — level4A(행정동)는 둘 다 동일해서
  // 사실상 어느 쪽이 걸려도 무방하지만, 의도를 코드로 남겨둔다.
  const results = data.response.result;
  const picked = results.find((r) => r.type === "road") ?? results[0];
  const s = picked.structure;

  const localPart = s.level4A || s.level3 || s.level2 || "";
  const sidoName = s.level1 || null;

  // 화면엔 "울산 북구"처럼 시·도 축약형을 붙여서 보여준다 — 구/동 이름만으로는
  // 어느 시·도인지 알 수 없다(예: "북구"는 울산/광주/부산에 다 있다).
  // resolveRegion이 "울산광역시" → "울산"으로 축약해준다(REGIONS 테이블 재사용).
  const sidoShort = sidoName ? (resolveRegion(sidoName)?.name ?? sidoName) : null;
  const displayName = localPart
    ? sidoShort
      ? `${sidoShort} ${localPart}`
      : localPart
    : "현재 위치";

  console.log("[geocode] address:", picked.text, "→", displayName);
  return { displayName, sidoName };
}
