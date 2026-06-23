/**
 * 화봉동 근처 카카오 전체 카테고리 수집 스크립트
 * 실행: npx tsx --env-file=.env.local scripts/kakao-search.ts [지역명] [반경m]
 * 예)  npx tsx --env-file=.env.local scripts/kakao-search.ts 화봉동 1000
 *
 * 결과는 콘솔 요약 + kakao-places.json 파일로 저장됩니다.
 */

import { writeFileSync } from "fs";

const REST_KEY = process.env.KAKAO_REST_KEY ?? "";
if (!REST_KEY) throw new Error("KAKAO_REST_KEY 환경변수가 없습니다.");

const ALL_CATEGORIES: Record<string, string> = {
  대형마트: "MT1",
  편의점: "CS2",
  어린이집: "PS3",
  학교: "SC4",
  학원: "AC5",
  주차장: "PK6",
  주유소: "OL7",
  지하철역: "SW8",
  은행: "BK9",
  문화시설: "CT1",
  중개업소: "AG2",
  공공기관: "PO3",
  관광명소: "AT4",
  숙박: "AD5",
  음식점: "FD6",
  카페: "CE7",
  병원: "HP8",
  약국: "PM9",
};

interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: string;
  category_group_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  place_url: string;
  distance: string;
}

interface KakaoResponse {
  documents: KakaoPlace[];
  meta: { is_end: boolean; pageable_count: number; total_count: number };
}

async function geocode(query: string) {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${REST_KEY}` } });
  if (!res.ok) throw new Error(`지오코딩 실패: ${res.status}`);
  const data = (await res.json()) as { documents: Array<{ x: string; y: string; address_name: string; place_name: string }> };
  if (!data.documents.length) throw new Error(`"${query}" 검색 결과 없음`);
  return data.documents[0];
}

async function fetchAllPages(
  lat: number,
  lng: number,
  code: string,
  name: string,
  radius: number,
): Promise<KakaoPlace[]> {
  const places: KakaoPlace[] = [];
  let page = 1;

  while (page <= 45) {
    const params = new URLSearchParams({
      category_group_code: code,
      x: String(lng),
      y: String(lat),
      radius: String(radius),
      sort: "distance",
      size: "15",
      page: String(page),
    });

    const res = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?${params}`, {
      headers: { Authorization: `KakaoAK ${REST_KEY}` },
    });

    if (!res.ok) {
      console.error(`  [${name}] p${page} 실패: ${res.status}`);
      break;
    }

    const data = (await res.json()) as KakaoResponse;
    places.push(...data.documents);

    if (data.meta.is_end || data.documents.length === 0) break;
    page++;
  }

  return places;
}

async function main() {
  const query = process.argv[2] ?? "화봉동";
  const radius = parseInt(process.argv[3] ?? "1000", 10);

  const origin = await geocode(query);
  const lat = parseFloat(origin.y);
  const lng = parseFloat(origin.x);
  console.log(`기준 위치: ${origin.place_name || origin.address_name} (lat=${lat}, lng=${lng})`);
  console.log(`반경 ${radius}m / 18개 카테고리 수집 중...\n`);

  const results = await Promise.all(
    Object.entries(ALL_CATEGORIES).map(async ([name, code]) => {
      const places = await fetchAllPages(lat, lng, code, name, radius);
      console.log(`  ${name.padEnd(6)} ${String(places.length).padStart(3)}개`);
      return places;
    }),
  );

  // 중복 제거 (id 기준)
  const seen = new Set<string>();
  const all = results.flat().filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  all.sort((a, b) => parseInt(a.distance) - parseInt(b.distance));

  console.log(`\n총 ${all.length}개 장소 수집 완료 (중복 제거 후)`);

  const outPath = "kakao-places.json";
  writeFileSync(outPath, JSON.stringify({ query, lat, lng, radius, total: all.length, places: all }, null, 2), "utf-8");
  console.log(`결과 저장: ${outPath}`);

  // 카테고리별 요약
  const byCategory: Record<string, number> = {};
  for (const p of all) {
    const key = p.category_group_name || "기타";
    byCategory[key] = (byCategory[key] ?? 0) + 1;
  }
  console.log("\n카테고리별 집계:");
  for (const [k, v] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(10)} ${v}개`);
  }
}

main().catch(console.error);
