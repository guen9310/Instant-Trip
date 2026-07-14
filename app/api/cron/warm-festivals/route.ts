import type { NextRequest } from "next/server";
import { fetchAndCachePublicFestivals } from "@/lib/pipeline/festival";
import { fetchAndCacheTourFestivals } from "@/lib/tour/searchFestival";

// Vercel Cron이 매일 호출해 축제 캐시를 강제 갱신한다 (stale-while-revalidate의
// 최초 콜드 상태를 흡수하는 용도). 좌표 무관 전국 공통 데이터라 위치 파라미터가 없다.
// 실측(2026-07-14) 기준 콜드 수집은 13~25초로 변동폭이 있었다. Hobby 플랜 기본/최대
// maxDuration이 300초라 여유가 크지만, 관측된 변동폭(약 2배)을 감안해 넉넉히 180초로
// 못박아 둔다 (300초 상한 대비도 충분한 여유).
//
// vercel.json의 스케줄 "0 15 * * *"는 UTC 기준이다 (KST 00:00 = UTC 15:00).
// JSON은 주석을 지원하지 않아 여기 남긴다. Hobby 플랜은 시간 단위 정밀도만 보장하므로
// 실제 실행은 UTC 15:00~15:59(KST 00:00~00:59) 사이 아무 때나 발생할 수 있다.
export const maxDuration = 180;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const t0 = Date.now();
  const [publicResult, tourResult] = await Promise.allSettled([
    fetchAndCachePublicFestivals(),
    fetchAndCacheTourFestivals(),
  ]);

  const publicOk = publicResult.status === "fulfilled";
  const tourOk = tourResult.status === "fulfilled";

  if (!publicOk) {
    console.warn(`[cron:warm-festivals] 공공데이터포털 갱신 실패 — ${publicResult.reason}`);
  }
  if (!tourOk) {
    console.warn(`[cron:warm-festivals] searchFestival2 갱신 실패 — ${tourResult.reason}`);
  }

  return Response.json({
    ok: publicOk && tourOk,
    publicCount: publicOk ? publicResult.value.length : null,
    tourCount: tourOk ? tourResult.value.length : null,
    publicError: publicOk ? null : String(publicResult.reason),
    tourError: tourOk ? null : String(tourResult.reason),
    durationMs: Date.now() - t0,
  });
}
