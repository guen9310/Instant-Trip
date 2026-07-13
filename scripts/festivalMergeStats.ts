/**
 * 축제 병합 통계 스크립트
 *
 * 실행:
 *   pnpm tsx --tsconfig tsconfig.json scripts/festivalMergeStats.ts
 *
 * 출력:
 *   - 공공/Tour/매칭/단독 건수, 이미지 보유율
 *   - 시작일 불일치 쌍 상위 5건
 *   - 이름 일치 + 좌표 5km 초과로 매칭 실패한 쌍
 *   - 울산 좌표 기준 울산조선해양축제 노출 여부
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env.local") });

function sep(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 56 - title.length))}`);
}

async function main() {
  const { getAllTourFestivals } = await import("@/lib/tour/searchFestival");
  const { getAllFestivals, fetchNearbyFestivals } = await import("@/lib/pipeline/festival");
  // getAllPublicFestivals는 festival.ts 내부 함수이므로, 원본 데이터를 분리 수집
  const { fetchCulturalFestivals } = await import("@/lib/clients/cultural-festival");
  const { mergeFestivals } = await import("@/lib/pipeline/festivalMerge");

  sep("1. 원본 데이터 수집");

  // 공공데이터포털 전수 수집 (캐시 우회 없이 기존 캐시 활용)
  console.log("공공데이터포털 수집 중...");
  const publicFestivals: (Awaited<ReturnType<typeof fetchCulturalFestivals>>)[number][] = [];
  for (let pageNo = 1; pageNo <= 5; pageNo++) {
    const page = await fetchCulturalFestivals({ pageNo, numOfRows: 1000 });
    publicFestivals.push(...page);
    if (page.length < 1000) break;
  }
  console.log(`공공데이터포털: ${publicFestivals.length}건`);

  console.log("searchFestival2 수집 중...");
  const tourFestivals = await getAllTourFestivals();
  console.log(`searchFestival2: ${tourFestivals.length}건`);

  sep("2. 병합 실행");
  const { festivals, stats } = mergeFestivals(publicFestivals, tourFestivals);
  const imageRate = festivals.length > 0
    ? ((stats.imageCount / festivals.length) * 100).toFixed(1)
    : "0.0";

  console.log(`공공데이터포털: ${stats.publicCount}건`);
  console.log(`searchFestival2: ${stats.tourCount}건`);
  console.log(`매칭 쌍: ${stats.matchedCount}쌍`);
  console.log(`공공 단독: ${stats.publicOnlyCount}건`);
  console.log(`Tour 단독: ${stats.tourOnlyCount}건`);
  console.log(`병합 후 총 ${festivals.length}건`);
  console.log(`이미지 보유: ${stats.imageCount}건 (${imageRate}%)`);
  console.log(`좌표 없이 이름 매칭: ${stats.coordMissMatchCount}건`);

  sep("3. 시작일 불일치 쌍 (상위 5건)");
  if (stats.dateMismatchPairs.length === 0) {
    console.log("없음 (두 소스 시작일 완전 일치)");
  } else {
    console.log(`총 ${stats.dateMismatchPairs.length}건 불일치`);
    for (const p of stats.dateMismatchPairs.slice(0, 5)) {
      const pubY = p.publicStart.slice(0, 4);
      const tourY = p.tourStart.slice(0, 4);
      const fresher = pubY >= tourY ? "공공" : "Tour";
      console.log(`  "${p.name}"`);
      console.log(`    공공: ${p.publicStart}  Tour: ${p.tourStart}  → ${fresher}가 최신`);
    }
  }

  sep("4. 이름 일치 + 좌표 5km 초과 매칭 실패 쌍");
  if (stats.distMismatchPairs.length === 0) {
    console.log("없음 (모든 이름 매칭 쌍이 거리 기준 통과)");
  } else {
    console.log(`총 ${stats.distMismatchPairs.length}건`);
    for (const p of stats.distMismatchPairs.slice(0, 10)) {
      console.log(`  "${p.name}" — ${p.distKm}km 이격`);
    }
  }

  sep("5. 울산 검증 — 울산조선해양축제 (07.24~26)");
  const ULSAN_LAT = 35.5384;
  const ULSAN_LNG = 129.3114;
  const RADIUS_KM = 50;

  const nearby = await fetchNearbyFestivals(ULSAN_LAT, ULSAN_LNG, RADIUS_KM);
  const allNearby = [...nearby.ongoing, ...nearby.upcoming];
  const target = allNearby.find((f) =>
    f.fstvlNm.includes("조선해양") || f.fstvlNm.includes("조선해양축제"),
  );

  if (target) {
    console.log(`✓ 노출됨: "${target.fstvlNm}"`);
    console.log(`  날짜: ${target.fstvlStartDate} ~ ${target.fstvlEndDate}`);
    console.log(`  이미지: ${target.imageUrl ?? "(없음)"}`);
    console.log(`  출처: ${(target.sources ?? ["(미설정)"]).join(", ")}`);
  } else {
    console.log("✗ 노출 안 됨 — 반경 내 미포함 또는 날짜 불일치");
    console.log(`  진행중 ${nearby.ongoing.length}건 / 예정 ${nearby.upcoming.length}건`);
    // 이름 포함 검색으로 후보 확인
    const candidate = festivals.find((f) => f.fstvlNm.includes("조선해양"));
    if (candidate) {
      console.log(`  전체에는 있음: "${candidate.fstvlNm}" (${candidate.fstvlStartDate}~${candidate.fstvlEndDate})`);
    }
  }

  console.log(`\n${"━".repeat(60)}`);
  console.log("병합 통계 완료");
  console.log(`${"━".repeat(60)}\n`);
}

main().catch((err) => {
  console.error("[festivalMergeStats] 오류:", err);
  process.exit(1);
});
