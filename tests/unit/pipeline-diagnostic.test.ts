/**
 * 파이프라인 진단 스크립트 — 수정 사항을 수시로 확인할 때 사용한다.
 * 실행: pnpm pipeline
 *
 * 확인 항목:
 *   1. [stage1] 카테고리 제외 — 숙박(AC 중 AC05 외)/쇼핑(SH)/음식(FD) 제거
 *   2. [stage1→2] lclsSystm 분포 — AC05(캠핑) 생존 여부, HS(사찰)/VE07(박물관) 분포
 *   3. [stage4] 태그 점수 — "조용함" 켠 사용자 기준 VE07이 HS와 비슷하게 오는지
 */
import { describe, it } from "vitest";
import { config } from "dotenv";
import { collectCandidates } from "@/lib/pipeline/collect";
import { collectKakaoCandidates } from "@/lib/pipeline/kakaoCollect";
import { filterByAvailability } from "@/lib/pipeline/availability";
import { scoreCandidates, applyMappingRules } from "@/lib/pipeline/scoring";
import type { UserProfile, PlaceWithTags } from "@/lib/pipeline/types";

config({ path: ".env.local" });

// 고창 도솔암 기준 좌표 (spec 확인 케이스)
const GOCHANGN_LOC = { mapX: 126.5639528575, mapY: 35.4806033555 };

const mkProfile = (overrides: Partial<UserProfile>): UserProfile => ({
  tagWeights: { 도보친화: 0, "1인여행": 0, 실내: 0, 조용함: 0 },
  preferFood: false,
  festivalAffinity: 0,
  location: GOCHANGN_LOC,
  scale: "여유롭게",
  areaCode: "",
  sigunguCode: "",
  ...overrides,
});

// ─────────────────────────────────────────────────────────
describe("파이프라인 진단", () => {
  it(
    "[1] 카테고리 제외 — 숙박/쇼핑/음식이 걸러지고 AC05(캠핑)는 통과하는지",
    async () => {
      const profile = mkProfile({ scale: "여유롭게" });
      const items = await collectCandidates(profile);

      section("수집 결과 (lclsSystm 전체 분포)");
      const s1Map = new Map<string, number>();
      const s2Map = new Map<string, number>();
      for (const item of items) {
        const s1 = item.lclsSystm1 ?? "(없음)";
        const s2 = item.lclsSystm2 ?? "(없음)";
        s1Map.set(s1, (s1Map.get(s1) ?? 0) + 1);
        s2Map.set(s2, (s2Map.get(s2) ?? 0) + 1);
      }
      console.log(`  총 ${items.length}건`);
      console.log("  lclsSystm1 분포:");
      for (const [k, v] of [...s1Map.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`    ${k}: ${v}건`);
      }
      console.log("  lclsSystm2 분포 (상위 10):");
      for (const [k, v] of [...s2Map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)) {
        console.log(`    ${k}: ${v}건`);
      }

      section("AC05(캠핑) 생존 목록");
      const camping = items.filter((i) => i.lclsSystm2 === "AC05");
      if (camping.length === 0) {
        console.log("  (없음 — 반경 내 캠핑장 없거나 제외됨)");
      } else {
        for (const c of camping) {
          console.log(
            `  ✅ ${c.title} | s1=${c.lclsSystm1} s2=${c.lclsSystm2} | ${c.addr1}`,
          );
        }
      }

      section("제외됐어야 할 항목 잔존 여부 (AC05 제외 숙박·SH·FD)");
      const shouldBeGone = items.filter(
        (i) =>
          (i.lclsSystm1 === "AC" && i.lclsSystm2 !== "AC05") ||
          i.lclsSystm1 === "SH" ||
          i.lclsSystm1 === "FD",
      );
      if (shouldBeGone.length === 0) {
        console.log("  ✅ 없음 — 제외 규칙 정상 동작");
      } else {
        console.log(`  ❌ ${shouldBeGone.length}건 잔존:`);
        for (const i of shouldBeGone) {
          console.log(
            `    ${i.title} | s1=${i.lclsSystm1} s2=${i.lclsSystm2}`,
          );
        }
      }
    },
    90_000,
  );

  it(
    "[2] 태그 점수 — '조용함' 켠 사용자 기준 VE07(박물관/미술관)이 HS(사찰)와 비슷하게 오는지",
    async () => {
      const profile = mkProfile({
        scale: "여유롭게",
        tagWeights: { 도보친화: 0, "1인여행": 0, 실내: 0, 조용함: 1 },
      });

      const items = await collectCandidates(profile);
      const available = await filterByAvailability(items);

      const withTags: PlaceWithTags[] = available.map((item) => ({
        ...item,
        tagScores: applyMappingRules(item),
      }));
      const scored = await scoreCandidates(withTags, profile);

      section("상위 20 점수 (조용함 가중치 1.0)");
      for (const c of scored.slice(0, 20)) {
        const s1 = c.item.lclsSystm1 ?? "-";
        const s2 = c.item.lclsSystm2 ?? "-";
        const tags = Object.entries(c.tagScores)
          .filter(([, v]) => v > 0)
          .map(([t, v]) => `${t}:${v}`)
          .join(" ");
        console.log(
          `  ${c.score.toFixed(3)} | ${c.item.title.padEnd(20)} s1=${s1} s2=${s2} | 태그: ${tags || "(없음)"}`,
        );
      }

      section("VE07(박물관/미술관) 항목 태그 점수");
      const ve07 = scored.filter((c) => c.item.lclsSystm2 === "VE07");
      if (ve07.length === 0) {
        console.log("  (반경 내 VE07 없음)");
      } else {
        for (const c of ve07) {
          const tags = Object.entries(c.tagScores)
            .filter(([, v]) => v > 0)
            .map(([t, v]) => `${t}:${v}`)
            .join(" ");
          console.log(`  score=${c.score.toFixed(3)} | ${c.item.title} | 태그: ${tags}`);
        }
      }

      section("HS(사찰/종교) 항목 태그 점수");
      const hs = scored.filter((c) => c.item.lclsSystm1 === "HS");
      if (hs.length === 0) {
        console.log("  (반경 내 HS 없음)");
      } else {
        for (const c of hs.slice(0, 5)) {
          const tags = Object.entries(c.tagScores)
            .filter(([, v]) => v > 0)
            .map(([t, v]) => `${t}:${v}`)
            .join(" ");
          console.log(`  score=${c.score.toFixed(3)} | ${c.item.title} | 태그: ${tags}`);
        }
      }
    },
    90_000,
  );

  it(
    "[3] 풀 파이프라인 — generateCourse 결과 (여유롭게, 조용함 켬)",
    async () => {
      // generateCourse를 직접 호출해서 최종 코스가 어떻게 나오는지 확인한다
      const { generateCourse } = await import("@/lib/pipeline/index");
      const profile = mkProfile({
        scale: "여유롭게",
        tagWeights: { 도보친화: 0, "1인여행": 0, 실내: 0, 조용함: 1 },
      });

      const result = await generateCourse(profile);
      const { course, debug } = result;

      section("수집→가용성→점수화 건수");
      console.log(
        `  수집: ${debug.collected.length}건 → 가용성통과: ${debug.available.length}건 → 점수화: ${debug.scored.length}건`,
      );

      section("최종 코스");
      if (course.mainPlace) {
        console.log(`  메인: ${course.mainPlace.title} (tags: ${course.mainPlace.tags.join(", ")})`);
      } else {
        console.log("  메인: 없음");
      }
      for (const p of course.nearbyPlaces) {
        console.log(`  연계: ${p.title} (tags: ${p.tags.join(", ")})`);
      }
    },
    120_000,
  );

  it(
    "[4] 카카오 정규화 — 공원이 회수되고 노이즈(카페/주차장)가 걸러지는지, 태그·체류시간 정상 부여",
    async () => {
      // 화봉동 좌표 (인천 서구)
      const HWABONG_LAT = 37.5293;
      const HWABONG_LNG = 126.6952;
      const RADIUS_M = 2000;

      const items = await collectKakaoCandidates(HWABONG_LAT, HWABONG_LNG, RADIUS_M);

      section("카카오 수집 결과 요약");
      const at4 = items.filter((i) => i.kakaoCategory === "AT4");
      const ct1 = items.filter((i) => i.kakaoCategory === "CT1");
      console.log(`  AT4(관광명소/공원): ${at4.length}건, CT1(문화시설): ${ct1.length}건, 합계: ${items.length}건`);

      section("source='kakao' 확인 (전체가 'kakao'여야 함)");
      const nonKakao = items.filter((i) => i.source !== "kakao");
      if (nonKakao.length === 0) {
        console.log("  ✅ 전체 source='kakao'");
      } else {
        console.log(`  ❌ source 오류 ${nonKakao.length}건: ${nonKakao.map((i) => i.title).join(", ")}`);
      }

      section("공원 키워드 포함 장소 (AT4 버킷)");
      const parks = at4.filter((i) => i.title.includes("공원"));
      if (parks.length === 0) {
        console.log("  (반경 내 공원 없음 또는 필터됨)");
      } else {
        for (const p of parks) {
          console.log(`  ✅ ${p.title} | ${p.addr1}`);
        }
      }

      section("태그 점수 검증 (kakao_category 규칙 적용)");
      for (const item of items.slice(0, 10)) {
        const tagScores = applyMappingRules(item);
        const tags = Object.entries(tagScores)
          .filter(([, v]) => v > 0)
          .map(([t, v]) => `${t}:${v}`)
          .join(" ");
        console.log(`  [${item.kakaoCategory}] ${item.title} | 태그: ${tags || "(없음)"}`);
      }

      section("체류시간 기본값 + 태그 샘플 확인");
      // AT4→도보친화+조용함 각 1.0, CT1→실내+조용함+도보친화 각 1.0
      const at4Sample = at4[0];
      const ct1Sample = ct1[0];
      if (at4Sample) {
        const t = applyMappingRules(at4Sample);
        console.log(
          `  AT4 샘플 "${at4Sample.title}" 태그: ${JSON.stringify(t)} (도보친화·조용함 1.0 기대)`,
        );
      }
      if (ct1Sample) {
        const t = applyMappingRules(ct1Sample);
        console.log(
          `  CT1 샘플 "${ct1Sample.title}" 태그: ${JSON.stringify(t)} (실내·조용함·도보친화 1.0 기대)`,
        );
      }
    },
    60_000,
  );
});

// ─────────────────────────────────────────────────────────
function section(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 48 - title.length))}`);
}
