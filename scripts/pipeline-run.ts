/**
 * 파이프라인 실행 스크립트 — 실제 API를 호출해 코스 결과를 콘솔에 출력한다.
 * 실행: pnpm pipeline [--scale 가볍게|적당히|여유롭게]
 *                    [--travel walk|min] [--party solo|group]
 *                    [--vibe quiet|lively] [--food matjip|any] [--indoor indoor|outdoor]
 *                    [--lat N] [--lng N] [--quiet]
 *
 * 플래그 없이 실행하면 인터랙티브 선택 모드로 진입한다.
 * 플래그:
 *   --scale    가볍게|적당히|여유롭게
 *   --travel   walk|min           이동 방식
 *   --party    solo|group         여행 인원
 *   --vibe     quiet|lively       장소 분위기
 *   --food     matjip|any         먹거리
 *   --indoor   indoor|outdoor     장소 유형
 *   --lat      위도 (기본값: 고창 도솔암 35.4806)
 *   --lng      경도 (기본값: 고창 도솔암 126.5640)
 *   --quiet    stage4 상세 로그 없이 요약만 출력
 */

import { config } from "dotenv";
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env.local") });

type TravelScale = "가볍게" | "적당히" | "여유롭게";
type TagKey = "도보친화" | "1인여행" | "실내" | "조용함";

interface Prefs {
  travel: "walk" | "min";
  party: "solo" | "group";
  vibe: "quiet" | "lively";
  food: "matjip" | "any";
  indoor: "indoor" | "outdoor";
}

const DEFAULT_PREFS: Prefs = {
  travel: "walk",
  party: "solo",
  vibe: "quiet",
  food: "matjip",
  indoor: "indoor",
};

const SCALES: TravelScale[] = ["가볍게", "적당히", "여유롭게"];

const PREF_META = {
  travel: {
    label: "이동 방식",
    options: [
      { id: "walk", text: "걷는 게 좋아요" },
      { id: "min", text: "이동 최소화" },
    ],
  },
  party: {
    label: "여행 인원",
    options: [
      { id: "solo", text: "혼자 여행해요" },
      { id: "group", text: "같이 다녀요" },
    ],
  },
  vibe: {
    label: "장소 분위기",
    options: [
      { id: "quiet", text: "조용한 곳" },
      { id: "lively", text: "활기찬 곳" },
    ],
  },
  food: {
    label: "먹거리",
    options: [
      { id: "matjip", text: "맛집이 중요해요" },
      { id: "any", text: "상관없어요" },
    ],
  },
  indoor: {
    label: "장소 유형",
    options: [
      { id: "indoor", text: "실내가 좋아요" },
      { id: "outdoor", text: "야외가 좋아요" },
    ],
  },
} as const;

const PREF_KEYS = ["travel", "party", "vibe", "food", "indoor"] as const;

const args = process.argv.slice(2);
const getArg = (flag: string) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
};
const hasArg = (flag: string) => args.includes(flag);

function prefsToProfile(prefs: Prefs) {
  return {
    tagWeights: {
      도보친화: prefs.travel === "walk" ? 1 : 0,
      "1인여행": prefs.party === "solo" ? 1 : 0,
      실내: prefs.indoor === "indoor" ? 1 : 0,
      조용함: prefs.vibe === "quiet" ? 1 : 0,
    } as Record<TagKey, number>,
    preferFood: prefs.food === "matjip",
    festivalAffinity:
      (prefs.indoor === "outdoor" ? 0.6 : 0) +
      (prefs.vibe === "lively" ? 0.4 : 0),
  };
}

function prefsLabel(prefs: Prefs): string {
  const parts: string[] = [];
  if (prefs.travel === "walk") parts.push("도보");
  if (prefs.party === "solo") parts.push("1인");
  if (prefs.vibe === "quiet") parts.push("조용함");
  else parts.push("활기참");
  if (prefs.indoor === "indoor") parts.push("실내");
  else parts.push("야외");
  if (prefs.food === "matjip") parts.push("맛집");
  return parts.join("-");
}

async function resolveOptions(): Promise<{ scale: TravelScale; prefs: Prefs }> {
  const hasCLIFlag = [
    ...PREF_KEYS.map((k) => `--${k}`),
    "--scale",
    "--lat",
    "--lng",
  ].some((f) => hasArg(f) || !!getArg(f));

  if (hasCLIFlag) {
    const rawScale = getArg("--scale") ?? "여유롭게";
    const scale: TravelScale = SCALES.includes(rawScale as TravelScale)
      ? (rawScale as TravelScale)
      : "여유롭게";
    const prefs: Prefs = {
      travel: (getArg("--travel") as Prefs["travel"]) ?? DEFAULT_PREFS.travel,
      party: (getArg("--party") as Prefs["party"]) ?? DEFAULT_PREFS.party,
      vibe: (getArg("--vibe") as Prefs["vibe"]) ?? DEFAULT_PREFS.vibe,
      food: (getArg("--food") as Prefs["food"]) ?? DEFAULT_PREFS.food,
      indoor: (getArg("--indoor") as Prefs["indoor"]) ?? DEFAULT_PREFS.indoor,
    };
    return { scale, prefs };
  }

  // ── 인터랙티브 모드 ─────────────────────────────────────────────
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const ask = (q: string) =>
    new Promise<string>((resolve) => rl.question(q, resolve));

  process.stdout.write("\n여행 규모를 선택하세요\n");
  SCALES.forEach((s, i) => process.stdout.write(`  ${i + 1}. ${s}\n`));
  const scaleAns = await ask("선택 (기본값 3·여유롭게): ");
  const scaleIdx = parseInt(scaleAns.trim()) - 1;
  const scale: TravelScale =
    scaleIdx >= 0 && scaleIdx < SCALES.length ? SCALES[scaleIdx] : "여유롭게";

  process.stdout.write("\n취향을 선택하세요\n");
  const prefs: Prefs = { ...DEFAULT_PREFS };
  for (const key of PREF_KEYS) {
    const meta = PREF_META[key];
    const defaultIdx =
      meta.options.findIndex((o) => o.id === DEFAULT_PREFS[key]) + 1;
    process.stdout.write(`\n${meta.label}\n`);
    meta.options.forEach((o, i) =>
      process.stdout.write(`  ${i + 1}. ${o.text}\n`),
    );
    const ans = await ask(`선택 (기본값 ${defaultIdx}): `);
    const idx = parseInt(ans.trim()) - 1;
    if (idx >= 0 && idx < meta.options.length) {
      (prefs as unknown as Record<string, string>)[key] = meta.options[idx].id;
    }
  }

  rl.close();
  process.stdout.write("\n");
  return { scale, prefs };
}

function sep(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
}

function printPlace(
  prefix: string,
  p: {
    title: string;
    address: string;
    tags: TagKey[];
    score: number;
    contentTypeId: string;
    availabilityUncertain: boolean;
    estimatedDurationMin: number;
  },
) {
  const uncertainTag = p.availabilityUncertain ? " ⚠ uncertain=true" : "";
  console.log(`  ${prefix} [${p.score.toFixed(3)}] ${p.title}${uncertainTag}`);
  console.log(`         type=${p.contentTypeId} | ${p.address}`);
  console.log(`         태그: ${p.tags.length ? p.tags.join(", ") : "(없음)"} | 예상 체류: ${p.estimatedDurationMin}분`);
}

async function run() {
  const { scale, prefs } = await resolveOptions();
  const { tagWeights, preferFood, festivalAffinity } = prefsToProfile(prefs);

  const quiet = hasArg("--quiet");

  // ── 로그 파일 설정 ──────────────────────────────────────────────
  const LOG_DIR = path.resolve(__dirname, "../docs/log");
  fs.mkdirSync(LOG_DIR, { recursive: true });

  const nowTs = new Date()
    .toISOString()
    .replace("T", "_")
    .replace(/:/g, "-")
    .slice(0, 19);
  const logPath = path.join(
    LOG_DIR,
    `${nowTs}_${scale}_${prefsLabel(prefs)}.log`,
  );
  const logStream = fs.createWriteStream(logPath, { flags: "w" });

  const _origLog = console.log.bind(console);
  const _origError = console.error.bind(console);
  console.log = (...a: unknown[]) => {
    _origLog(...a);
    logStream.write(a.map(String).join(" ") + "\n");
  };
  console.error = (...a: unknown[]) => {
    _origError(...a);
    logStream.write("[ERR] " + a.map(String).join(" ") + "\n");
  };
  // ────────────────────────────────────────────────────────────────

  if (quiet) {
    const orig = console.log.bind(console);
    console.log = (...a: unknown[]) => {
      const msg = String(a[0] ?? "");
      if (msg.startsWith("[stage4]") && !msg.includes("완료")) return;
      orig(...a);
    };
  }

  const { generateCourse } = await import("@/lib/pipeline/index");

  const DEFAULT_LAT = 35.58768844003099;
  const DEFAULT_LNG = 129.36848448986822;
  const parsedLat = parseFloat(getArg("--lat") ?? "");
  const parsedLng = parseFloat(getArg("--lng") ?? "");
  const LOCATION = {
    mapX: isNaN(parsedLng) ? DEFAULT_LNG : parsedLng,
    mapY: isNaN(parsedLat) ? DEFAULT_LAT : parsedLat,
  };

  console.log(`\n${"━".repeat(60)}`);
  console.log(`  파이프라인 실행`);
  console.log(`  좌표: (${LOCATION.mapY}, ${LOCATION.mapX}) | 규모: ${scale}`);
  console.log(
    `  취향: travel=${prefs.travel} party=${prefs.party} vibe=${prefs.vibe} food=${prefs.food} indoor=${prefs.indoor}`,
  );
  console.log(
    `  태그 가중치: ${JSON.stringify(tagWeights)} | preferFood=${preferFood} festivalAffinity=${festivalAffinity}`,
  );
  console.log(`${"━".repeat(60)}\n`);

  const result = await generateCourse(
    {
      tagWeights,
      preferFood,
      festivalAffinity,
      location: LOCATION,
      scale,
      areaCode: "",
      sigunguCode: "",
    },
    {},
  );

  const { course, debug } = result;

  sep("파이프라인 요약");
  console.log(
    `  수집: ${debug.collected.length}건`,
    `→ 가용성통과: ${debug.available.length}건`,
    `→ 점수화: ${debug.scored.length}건`,
  );
  console.log(
    `  코스에 포함된 장소: ${debug.scored.filter((c) => c.inCourse).length}곳`,
  );

  sep("최종 코스");
  if (!course.mainPlace) {
    console.log("  메인 장소 없음 — 후보 부족");
  } else {
    printPlace("메인 ", course.mainPlace);
  }
  for (const p of course.nearbyPlaces) {
    printPlace("연계 ", p);
  }

  sep("축제 (ongoing/upcoming)");
  console.log(`  진행중 ${course.festivals.ongoing.length}건, 예정 ${course.festivals.upcoming.length}건`);
  for (const f of course.festivals.ongoing) {
    console.log(`  [진행중] ${f.fstvlNm} (${f.fstvlStartDate}~${f.fstvlEndDate})`);
  }
  for (const f of course.festivals.upcoming) {
    console.log(`  [예정]   ${f.fstvlNm} (${f.fstvlStartDate}~${f.fstvlEndDate})`);
  }

  sep("식당 추천 (preferFood)");
  if (course.recommended_food) {
    console.log(`  ${course.recommended_food.name} (${course.recommended_food.distanceM}m) | ${course.recommended_food.category}`);
  } else {
    console.log(`  (없음 — preferFood=${preferFood})`);
  }

  sep("점수화 상위 10 (전체)");
  for (const c of debug.scored.slice(0, 10)) {
    const inCourse = c.inCourse ? "★" : " ";
    const s1 = c.item.lclsSystm1 ?? "-";
    const s2 = c.item.lclsSystm2 ?? "-";
    const tags = Object.entries(c.tagScores)
      .filter(([, v]) => v > 0)
      .map(([t, v]) => `${t}:${v}`)
      .join(" ");
    console.log(
      `  ${inCourse} ${c.score.toFixed(3)} | ${c.item.title.padEnd(22)} lcs:${s1}/${s2} | ${tags || "(태그없음)"}`,
    );
  }

  sep("카테고리별 통과 분포 (lclsSystm1)");
  const s1Map = new Map<string, number>();
  for (const c of debug.scored) {
    const s1 = c.item.lclsSystm1 ?? "(없음)";
    s1Map.set(s1, (s1Map.get(s1) ?? 0) + 1);
  }
  for (const [k, v] of [...s1Map.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}건`);
  }

  sep("AC05(캠핑) 후보 생존 여부");
  const camping = debug.scored.filter((c) => c.item.lclsSystm2 === "AC05");
  if (camping.length === 0) {
    console.log("  (없음)");
  } else {
    for (const c of camping) {
      console.log(
        `  ${c.score.toFixed(3)} | ${c.item.title} | ${c.item.addr1}`,
      );
    }
  }

  console.log(`\n${"━".repeat(60)}\n`);

  await new Promise<void>((resolve) => {
    logStream.end(() => {
      _origLog(`로그 저장: ${logPath}`);
      resolve();
    });
  });
}

run().catch((err) => {
  console.error("[pipeline-run] 오류:", err);
  process.exit(1);
});
