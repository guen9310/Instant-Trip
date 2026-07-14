/**
 * 장소 선택 기반 코스 생성 데이터 층 검증 스크립트 (7-A)
 *
 * 실행:
 *   pnpm place --content-id <ID> --content-type-id <12|14|28> [--lat N] [--lng N]
 *
 * 기본 좌표: 울산시청 (35.5384, 129.3114)
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env.local") });

const args = process.argv.slice(2).filter((a) => a !== "--");
const getArg = (flag: string) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
};

function sep(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
}

async function main() {
  const { generateCourseFromPlace } = await import("@/lib/pipeline/selectPlace");

  const DEFAULT_LAT = 35.5384;
  const DEFAULT_LNG = 129.3114;

  const contentId = getArg("--content-id");
  const contentTypeId = getArg("--content-type-id") ?? "12";
  const lat = parseFloat(getArg("--lat") ?? "") || DEFAULT_LAT;
  const lng = parseFloat(getArg("--lng") ?? "") || DEFAULT_LNG;

  if (!contentId) {
    console.error("사용법: pnpm place --content-id <ID> [--content-type-id 12|14|28] [--lat N] [--lng N]");
    process.exit(1);
  }

  console.log(`\n${"━".repeat(60)}`);
  console.log(`  장소 선택 기반 코스 생성 실행`);
  console.log(`  contentId=${contentId} contentTypeId=${contentTypeId} | 좌표: (${lat}, ${lng})`);
  console.log(`${"━".repeat(60)}\n`);

  const result = await generateCourseFromPlace({ contentId, contentTypeId, lat, lng });

  sep("결과");
  if (!result.ok) {
    console.log(`  실패 — code=${result.code} error="${result.error}"`);
    return;
  }

  const { mainPlace, availability, festivals } = result;
  console.log(`  ok=true`);
  console.log(`  mainPlace: [${mainPlace.contentTypeId}] ${mainPlace.title} | ${mainPlace.shortAddress}`);
  console.log(`  origin: ${mainPlace.origin}`);
  console.log(`  tags: ${mainPlace.tags.length ? mainPlace.tags.join(", ") : "(없음)"}`);
  console.log(`  이미지: ${mainPlace.images.length}장 | 개요: ${mainPlace.overview ? mainPlace.overview.length + "자" : "없음"}`);
  console.log(`  예상 체류: ${mainPlace.estimatedDuration.min}~${mainPlace.estimatedDuration.max}분 (key=${mainPlace.stayDurationKey})`);

  sep("가용성 (availability)");
  console.log(`  isOpenNow: ${availability.isOpenNow === null ? "null (판단 불가)" : availability.isOpenNow}`);
  console.log(`  hours: ${availability.hours ?? "(없음)"}`);
  console.log(`  restDayNote: ${availability.restDayNote ?? "(없음)"}`);

  sep("축제 (ongoing/upcoming)");
  console.log(`  진행중 ${festivals.ongoing.length}건, 예정 ${festivals.upcoming.length}건`);
  for (const f of festivals.ongoing) {
    console.log(`  [진행중] ${f.fstvlNm} (${f.fstvlStartDate}~${f.fstvlEndDate})`);
  }

  console.log(`\n${"━".repeat(60)}\n`);
}

main().catch((err) => {
  console.error("[place-run] 오류:", err);
  process.exit(1);
});
