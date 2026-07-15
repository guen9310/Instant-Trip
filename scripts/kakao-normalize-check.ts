/**
 * 카카오 후보 정규화 검증 스크립트 (작업 A 검증용)
 * 실행: pnpm tsx --env-file=.env.local scripts/kakao-normalize-check.ts
 *
 * 확인 항목:
 *   1. AT4/CT1 카테고리 + 공원 키워드 수집 건수
 *   2. 노이즈(카페/주차장 등) 걸러지는지
 *   3. source='kakao' 세팅 확인
 *   4. kakao_category 규칙으로 태그 부여 확인
 *   5. 체류시간 기본값 (STAY_DURATION_TABLE의 kakao:AT4 / kakao:CT1 규칙)
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env.local") });

import { collectKakaoCandidates } from "@/lib/pipeline/kakaoCollect";
import { applyMappingRules } from "@/lib/pipeline/scoring";
import { estimateStayDuration } from "@/lib/pipeline/stayDuration";
import { formatDuration } from "@/shared/utils/duration";

const LAT = 35.5923;
const LNG = 129.3651;
const RADIUS_M = 2000;

function sep(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
}

async function run() {
  console.log(`\n${"━".repeat(60)}`);
  console.log(`  카카오 정규화 검증`);
  console.log(`  좌표: (${LAT}, ${LNG}) | 반경: ${RADIUS_M}m`);
  console.log(`${"━".repeat(60)}\n`);

  const items = await collectKakaoCandidates(LAT, LNG, RADIUS_M);

  sep("수집 결과 요약");
  const at4 = items.filter((i) => i.kakaoCategory === "AT4");
  const ct1 = items.filter((i) => i.kakaoCategory === "CT1");
  console.log(`  AT4(관광명소/공원): ${at4.length}건`);
  console.log(`  CT1(문화시설):      ${ct1.length}건`);
  console.log(`  합계:               ${items.length}건`);

  sep("source='kakao' 확인");
  const nonKakao = items.filter((i) => i.source !== "kakao");
  if (nonKakao.length === 0) {
    console.log("  ✅ 전체 source='kakao'");
  } else {
    console.log(
      `  ❌ source 오류 ${nonKakao.length}건: ${nonKakao.map((i) => i.title).join(", ")}`,
    );
  }

  sep("공원 키워드 포함 장소 (AT4 버킷)");
  const parks = at4.filter((i) => i.title.includes("공원"));
  if (parks.length === 0) {
    console.log("  (반경 내 공원 없음 또는 전부 필터됨)");
  } else {
    for (const p of parks) {
      console.log(`  ✅ ${p.title} | ${p.addr1}`);
    }
  }

  sep("AT4 전체 목록");
  for (const p of at4) {
    console.log(`  ${p.title} | ${p.addr1}`);
  }

  sep("CT1 전체 목록");
  for (const p of ct1) {
    console.log(`  ${p.title} | ${p.addr1}`);
  }

  sep("태그 점수 (kakao_category 규칙)");
  for (const item of items) {
    const tagScores = applyMappingRules(item);
    const tags = Object.entries(tagScores)
      .filter(([, v]) => v > 0)
      .map(([t, v]) => `${t}:${v}`)
      .join("  ");
    const dur = formatDuration(
      estimateStayDuration({ source: "kakao", kakaoCategory: item.kakaoCategory }),
    );
    console.log(
      `  [${item.kakaoCategory}] ${item.title.padEnd(24)} 태그: ${tags || "(없음)"}  체류:${dur}`,
    );
  }

  console.log(`\n${"━".repeat(60)}\n`);
}

run().catch((err) => {
  console.error("[kakao-normalize-check] 오류:", err);
  process.exit(1);
});
