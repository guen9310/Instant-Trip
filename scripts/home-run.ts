/**
 * 홈 데이터 층 검증 스크립트
 *
 * 실행:
 *   pnpm home [--lat N] [--lng N] [--city <이름>]
 *   pnpm home --region <지역명>            # getHomeDataByRegionAction 경로
 *   pnpm home --validate-areacodes         # 17개 시·도 areaCode 전수 확인
 *   pnpm home --verify-geocode             # 지오코딩→시도 매칭 3좌표 검증
 *
 * 기본 좌표: 울산시청 (35.5384, 129.3114)
 * 기본 도시: 울산광역시
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env.local") });

// pnpm run home -- --flag 형태로 실행 시 "--"가 첫 번째 arg로 전달되므로 필터링
const args = process.argv.slice(2).filter((a) => a !== "--");
const getArg = (flag: string) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
};
const hasArg = (flag: string) => args.includes(flag);

function sep(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
}

async function main() {
  // API 의존 모듈은 dotenv 설정 후 동적 import — pipeline-run.ts와 같은 패턴
  const { resolveRegion, REGIONS } = await import("@/lib/tour/regionMap");
  const { fetchHomeCore } = await import("@/lib/home/core");
  const { fetchAreaBasedList } = await import("@/lib/tour/areaBasedList");

  // ── 검증 모드 1: 17개 시·도 areaCode 전수 확인 ──────────────────────────
  // ── 검증 모드 0: 지오코딩→시도 매칭 3좌표 검증 ─────────────────────────
  if (hasArg("--verify-geocode")) {
    sep("지오코딩 → resolveRegion 3좌표 검증");

    const CASES = [
      { label: "울산시청 (광역시)", lat: 35.5384, lng: 129.3114, expected: "울산" },
      { label: "수원시청 (경기도)", lat: 37.2636, lng: 127.0286, expected: "경기" },
      { label: "세종시청 (특별자치시)", lat: 36.4800, lng: 127.2890, expected: "세종" },
    ];

    let allPassed = true;
    for (const tc of CASES) {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${tc.lat}&lon=${tc.lng}&format=json`,
        { headers: { "Accept-Language": "ko", "User-Agent": "untitle-app/1.0" } },
      );
      const data = await res.json();
      const a = data.address ?? {};
      const sidoName: string | null =
        a.province ||
        (a.city && /광역시|특별시|특별자치시/.test(a.city) ? a.city : null);

      const region = resolveRegion(sidoName ?? "");
      const ok = region?.name === tc.expected;
      allPassed = allPassed && ok;
      console.log(
        `  ${ok ? "✓" : "✗"} ${tc.label}`,
        `\n    sidoName="${sidoName}" → region=${region?.name ?? "null"}`,
        ok ? "" : `(기대값: ${tc.expected})`,
      );
    }
    console.log(allPassed ? "\n3좌표 모두 매칭 성공 ✓" : "\n일부 매칭 실패 ✗");
    if (!allPassed) process.exit(1);
    return;
  }

  if (hasArg("--validate-areacodes")) {
    sep("17개 시·도 areaCode 전수 확인 (관광지 1건씩)");
    const results: { name: string; areaCode: string; ok: boolean }[] = [];

    for (const region of REGIONS) {
      const items = await fetchAreaBasedList(region.areaCode, "12", "R", 1, 1);
      const ok = items.length > 0;
      results.push({ name: region.name, areaCode: region.areaCode, ok });
      console.log(
        `  ${ok ? "✓" : "✗"} ${region.name.padEnd(4)} (areaCode=${region.areaCode.padStart(2)}) → ${items.length}건`,
      );
    }

    const failed = results.filter((r) => !r.ok);
    if (failed.length === 0) {
      console.log("\n모든 areaCode 정상 응답 ✓");
    } else {
      console.error(`\n${failed.length}개 areaCode 빈 응답: ${failed.map((r) => r.name).join(", ")}`);
      process.exit(1);
    }
    return;
  }

  // ── 검증 모드 2: 코어 함수 실행 ─────────────────────────────────────────
  const runCore = async () => {
    const DEFAULT_LAT = 35.5384;
    const DEFAULT_LNG = 129.3114;
    const DEFAULT_CITY = "울산광역시";

    const lat = parseFloat(getArg("--lat") ?? "") || DEFAULT_LAT;
    const lng = parseFloat(getArg("--lng") ?? "") || DEFAULT_LNG;
    const cityArg = getArg("--city") ?? DEFAULT_CITY;
    const regionArg = getArg("--region");

    const cityName = regionArg !== undefined ? regionArg : cityArg;
    const useRegionFallback = regionArg !== undefined;

    const region = resolveRegion(cityName);

    console.log(`\n${"━".repeat(60)}`);
    console.log(`  홈 데이터 코어 함수 실행`);
    if (useRegionFallback) {
      console.log(`  모드: getHomeDataByRegionAction (폴백)`);
      console.log(`  regionName: "${cityName}"`);
    } else {
      console.log(`  모드: getHomeDataAction (GPS 좌표 포함)`);
      console.log(`  좌표: (${lat}, ${lng}) | city: "${cityName}"`);
    }
    console.log(`  region 매칭: ${region ? `${region.name} (areaCode=${region.areaCode})` : "null (매칭 실패)"}`);
    console.log(`${"━".repeat(60)}\n`);

    const effectiveLat = useRegionFallback && region ? region.lat : lat;
    const effectiveLng = useRegionFallback && region ? region.lng : lng;

    const result = await fetchHomeCore(effectiveLat, effectiveLng, region);

    sep("결과 요약");
    console.log(`  region: ${result.region ? `${result.region.name} (areaCode=${result.region.areaCode})` : "null"}`);
    console.log(`  places: ${result.places.length}건`);
    console.log(`  ongoingFestivals: ${result.ongoingFestivals.length}건`);
    console.log(`  upcomingFestivals: ${result.upcomingFestivals.length}건`);
    console.log(`  errors: ${result.errors.length ? result.errors.join(", ") : "(없음)"}`);

    if (result.places.length > 0) {
      sep("장소 목록 (상위 5건)");
      for (const p of result.places.slice(0, 5)) {
        console.log(`  [${p.contenttypeid}] ${p.title} — ${p.addr1}`);
      }
    }

    if (result.ongoingFestivals.length > 0) {
      sep("진행중 축제");
      for (const f of result.ongoingFestivals.slice(0, 3)) {
        console.log(`  ${f.name} (${f.period})`);
      }
    }

    if (result.upcomingFestivals.length > 0) {
      sep("예정 축제");
      for (const f of result.upcomingFestivals.slice(0, 3)) {
        console.log(`  ${f.name} (${f.period})`);
      }
    }

    console.log(`\n${"━".repeat(60)}\n`);
    return result;
  };

  // 검증 1: 1회차 실행
  console.log("=== 1회차 실행 ===");
  await runCore();

  // 검증 3: 2회차 실행 — areaBasedList2 캐시 HIT 확인
  if (!hasArg("--no-cache-check") && !hasArg("--region")) {
    console.log("\n=== 2회차 실행 (캐시 HIT 확인) ===");
    await runCore();
  }
}

main().catch((err) => {
  console.error("[home-run] 오류:", err);
  process.exit(1);
});
