/**
 * 관광지 집중률 방문자 추이 예측(TatsCnctrRateService) 이름 매칭 스팟체크
 * 실행: pnpm tsx --env-file=.env.local scripts/concentration-name-match-check.ts
 *       [--area-cd 51] [--signgu-cd 51130] [--lat 37.3422] [--lng 127.9202] [--radius 15000]
 *
 * 목적:
 *   TatsCnctrRateService(관광지 집중률)는 contentid·좌표 없이 관광지명(tAtsNm)
 *   텍스트만 준다. 기존 파이프라인이 쓰는 locationBasedList2(KorService2)의
 *   장소명(title)과 얼마나 정확히 이름이 일치하는지 실측해서, 이름 기반 매칭이
 *   실용적인 신뢰도를 가지는지 확인한다.
 *
 * 기본 좌표: 원주시청 근방 (원주시 areaCd=51/signguCd=51130) — 두 매뉴얼의
 *   worked example이 공통으로 이 지역을 쓰고 있어 결과 비교가 쉽다.
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import type { TourItem } from "@/lib/tour/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env.local") });

const args = process.argv.slice(2).filter((a) => a !== "--");
const getArg = (flag: string) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
};

const AREA_CD = getArg("--area-cd") ?? "51";
const SIGNGU_CD = getArg("--signgu-cd") ?? "51130";
const LAT = parseFloat(getArg("--lat") ?? "") || 37.3422;
const LNG = parseFloat(getArg("--lng") ?? "") || 127.9202;
const RADIUS_M = parseInt(getArg("--radius") ?? "", 10) || 15000;

interface CnctrItem {
  baseYmd: string;
  areaCd: string;
  areaNm?: string;
  signguCd: string;
  signguNm?: string;
  tAtsNm: string;
  cnctrRate: string;
}

function sep(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
}

async function main() {
  // dotenv config()가 끝난 뒤에 import해야 한다 — lib/tour/client.ts는
  // 모듈 로드 시점에 process.env.TOUR_API_KEY 존재 여부를 즉시 검사한다.
  const { tourFetch, extractItems, createApiFetch } = await import("@/lib/tour/client");
  const { ENDPOINTS } = await import("@/lib/tour/endpoints");

  console.log(`\n${"━".repeat(60)}`);
  console.log(`  관광지 집중률(TatsCnctrRateService) 이름 매칭 스팟체크`);
  console.log(
    `  지역: areaCd=${AREA_CD} signguCd=${SIGNGU_CD} | 좌표: (${LAT}, ${LNG}) 반경 ${(RADIUS_M / 1000).toFixed(0)}km`,
  );
  console.log(`${"━".repeat(60)}\n`);

  // 1) 기존 KorService2 locationBasedList2 — 파이프라인이 실제로 쓰는 후보 장소명
  sep("1) locationBasedList2 (기존 서비스) 후보 수집");
  const locRes = await tourFetch<TourItem>(ENDPOINTS.LOCATION_BASED_LIST, {
    mapX: LNG,
    mapY: LAT,
    radius: RADIUS_M,
    arrange: "E",
    numOfRows: 100,
  });
  const places = extractItems(locRes);
  console.log(`  수집: ${places.length}건`);
  const placeTitles = new Set(places.map((p) => p.title.trim()));

  // 2) TatsCnctrRateService tatsCnctrRatedList — tAtsNm 필터 없이 지역 전체 조회
  //    (장소 1개당 30일치 로우가 나오므로 pageNo를 넘겨가며 모두 모은다)
  sep("2) tatsCnctrRatedList (신규 서비스) 관광지명 수집");
  const cnctrFetch = createApiFetch("https://apis.data.go.kr/B551011/TatsCnctrRateService");
  const cnctrItems: CnctrItem[] = [];
  let pageNo = 1;
  let totalCount = Infinity;
  while (cnctrItems.length < totalCount && pageNo <= 20) {
    const res = await cnctrFetch<CnctrItem>("tatsCnctrRatedList", {
      areaCd: AREA_CD,
      signguCd: SIGNGU_CD,
      numOfRows: 500,
      pageNo,
    });
    const items = extractItems(res);
    cnctrItems.push(...items);
    totalCount = res.response.body.totalCount;
    if (items.length === 0) break;
    pageNo++;
  }
  console.log(`  수집: ${cnctrItems.length}건(관광지×기간 로우, totalCount=${totalCount})`);

  const cnctrNames = new Map<string, CnctrItem>(); // 이름 → 대표 로우 1건
  for (const c of cnctrItems) {
    const key = c.tAtsNm.trim();
    if (!cnctrNames.has(key)) cnctrNames.set(key, c);
  }
  console.log(`  고유 관광지명: ${cnctrNames.size}개`);
  for (const [name, sample] of cnctrNames) {
    console.log(`    - ${name} (${sample.baseYmd} 집중률 예시: ${sample.cnctrRate})`);
  }

  // 3) 이름 일치 비교
  sep("3) 이름 매칭 결과");
  const matchedNames: string[] = [];
  const unmatchedCnctrNames: string[] = [];
  for (const name of cnctrNames.keys()) {
    if (placeTitles.has(name)) matchedNames.push(name);
    else unmatchedCnctrNames.push(name);
  }

  console.log(
    `  집중률 API 관광지명 중 locationBasedList2 title과 정확히 일치: ${matchedNames.length}/${cnctrNames.size}`,
  );
  if (matchedNames.length > 0) {
    console.log(`\n  ✅ 매칭됨:`);
    for (const n of matchedNames) console.log(`     - ${n}`);
  }
  if (unmatchedCnctrNames.length > 0) {
    console.log(`\n  ❌ 매칭 안 됨 (반경 밖에 있거나 이름 표기가 다를 수 있음):`);
    for (const n of unmatchedCnctrNames) console.log(`     - ${n}`);
  }

  // 4) 정밀 진단 — 실패 원인이 "반경 밖"인지 "이름 표기 차이"인지 구분한다.
  //    공백·괄호 접미사(예: "(원주)")를 제거하고 다시 비교해서,
  //    정규화 후에도 안 걸리면 진짜 반경 밖(수집 후보 자체가 없음)일 가능성이 높다.
  sep("4) 정밀 진단 — 반경 밖 vs 이름 표기 차이");
  const normalize = (s: string) =>
    s.replace(/\s+/g, "").replace(/\([^)]*\)/g, "");
  const normPlaceTitles = new Map<string, string>();
  for (const p of places) normPlaceTitles.set(normalize(p.title), p.title);

  const stillUnmatched: string[] = [];
  const recoveredByNormalize: Array<{ cnctr: string; place: string }> = [];
  for (const n of unmatchedCnctrNames) {
    const hit = normPlaceTitles.get(normalize(n));
    if (hit) recoveredByNormalize.push({ cnctr: n, place: hit });
    else stillUnmatched.push(n);
  }

  console.log(
    `  정규화(공백/괄호 제거) 후 추가로 일치: ${recoveredByNormalize.length}건`,
  );
  for (const { cnctr, place } of recoveredByNormalize) {
    console.log(`     - "${cnctr}"  ↔  "${place}"`);
  }

  console.log(
    `\n  정규화해도 매칭 안 됨(= locationBasedList2 100건 후보 안에 아예 없음, 반경 밖일 가능성): ${stillUnmatched.length}건`,
  );
  for (const n of stillUnmatched) console.log(`     - ${n}`);

  const won = places.filter((p) => p.addr1.includes("원주")).length;
  console.log(
    `\n  참고: locationBasedList2 100건 중 주소에 "원주" 포함: ${won}건 (반경 15km가 원주시 전역을 커버 못 할 수 있음을 가늠하는 참고치)`,
  );

  // 5) 진짜 이름 호환성 검증 — 반경 제한 없는 searchKeyword2(전국 키워드 검색)로
  //    "정규화해도 매칭 안 됨" 항목들을 다시 확인한다. 여기서도 안 걸리면
  //    반경 샘플링 한계가 아니라 실제 이름 표기 차이(또는 TourAPI 미등재)다.
  sep("5) searchKeyword2(전국 키워드 검색)로 재검증");
  const { sleep } = await import("@/lib/tour/client");
  let keywordMatched = 0;
  const keywordUnmatched: string[] = [];
  for (const name of stillUnmatched) {
    const res = await tourFetch<TourItem>("searchKeyword2", {
      keyword: name,
      numOfRows: 20,
    });
    const hits = extractItems(res);
    const exact = hits.find((h) => normalize(h.title) === normalize(name));
    if (exact) {
      keywordMatched++;
      console.log(`  ✅ "${name}" → searchKeyword2에서 "${exact.title}" 발견`);
    } else {
      keywordUnmatched.push(name);
      console.log(
        `  ❌ "${name}" → 일치 없음 (검색 결과 ${hits.length}건: ${hits.slice(0, 3).map((h) => h.title).join(", ") || "없음"})`,
      );
    }
    await sleep(150);
  }

  console.log(
    `\n  전국 키워드 검색으로 추가 확인된 일치: ${keywordMatched}/${stillUnmatched.length}`,
  );
  console.log(
    `  최종 진짜 불일치(반경과 무관하게 이름이 안 맞거나 TourAPI에 없음): ${keywordUnmatched.length}/${cnctrNames.size}`,
  );

  console.log(`\n${"━".repeat(60)}\n`);
}

main().catch((err) => {
  console.error("[concentration-name-match-check] 오류:", err);
  process.exit(1);
});
