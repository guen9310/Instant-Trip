import { tourFetch, extractItems } from "@/lib/tour/client";
import { readCache, writeCache, writeCacheEmpty, CACHE_EMPTY } from "@/lib/tour/cache";
import { ENDPOINTS } from "@/lib/tour/endpoints";
import { TTL } from "@/lib/cache/ttl";
import type { TourDetailIntroFestival } from "@/lib/tour/types";
import type { FestivalProgramInfo } from "@/shared/types/course.types";
import { isBlank } from "@/shared/utils";

const FESTIVAL_CONTENT_TYPE_ID = "15";

export function cleanFestivalText(raw: string): string | null {
  if (isBlank(raw)) return null;
  const cleaned = raw
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
  return isBlank(cleaned) ? null : cleaned;
}

// Tour API에 매칭된 축제 하나의 detailIntro2 원본을 조회한다(캐시 우선).
// 캐시 키는 checkPlaceAvailability(장소 가용성 검사)와 동일한 규칙(tour:detailIntro2:{contentId})을
// 써서, 같은 contentId가 두 경로에서 각각 호출돼도 캐시를 공유한다.
// program(행사 프로그램 소개)과 playtime(운영시간) 둘 다 이 함수 하나로 얻는다 —
// 호출부가 둘 다 필요하면(축제 선택 진입) 별도 호출 없이 이 결과를 그대로 재사용한다.
export async function getFestivalIntro(
  contentId: string,
): Promise<TourDetailIntroFestival | null> {
  const cacheKey = `tour:detailIntro2:${contentId}`;
  const cached = await readCache<TourDetailIntroFestival>(cacheKey);

  if (cached === CACHE_EMPTY) return null;
  if (cached !== null) return cached;

  try {
    const data = await tourFetch<TourDetailIntroFestival>(ENDPOINTS.DETAIL_INTRO, {
      contentId,
      contentTypeId: FESTIVAL_CONTENT_TYPE_ID,
    });
    const intro = extractItems(data)[0];
    if (!intro) {
      await writeCacheEmpty(cacheKey, TTL.EMPTY_RESULT);
      return null;
    }
    await writeCache(cacheKey, intro, TTL.DETAIL_INTRO);
    return intro;
  } catch (err) {
    console.warn(`[festivalDetail] detailIntro2 조회 실패 (contentId=${contentId}) — ${err}`);
    return null;
  }
}

const MAIN_PROGRAM_LABEL = /^-?\s*주요\s*프로그램\s*[:：]\s*/;
const EXTRA_PROGRAM_LABEL = /^-?\s*부대\s*(?:행사\s*(?:및|밎)?\s*)?프로그램\s*[:：]\s*/;

// program(detailIntro2) 원문을 "주요 프로그램" 한 줄 + "부대 행사" 칩 목록으로 구조화한다.
// 실측(가든 나이트 마켓)은 "- 주요 프로그램 : ...\n- 부대 행사 및 프로그램 : A / B / C"
// 형태였으나, 축제마다 원문 형식이 다를 수 있어 라벨을 못 찾으면 전체 텍스트를 그대로
// main에 담아 최소한의 정보는 보여준다(extra는 그 경우 빈 배열).
export function parseFestivalProgram(raw: string): FestivalProgramInfo | null {
  const cleaned = cleanFestivalText(raw);
  if (!cleaned) return null;

  let main: string | null = null;
  let extra: string[] = [];
  let recognizedAny = false;

  for (const line of cleaned.split("\n")) {
    if (MAIN_PROGRAM_LABEL.test(line)) {
      main = line.replace(MAIN_PROGRAM_LABEL, "").trim();
      recognizedAny = true;
    } else if (EXTRA_PROGRAM_LABEL.test(line)) {
      extra = line
        .replace(EXTRA_PROGRAM_LABEL, "")
        .split("/")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      recognizedAny = true;
    }
  }

  if (!recognizedAny) {
    return { main: cleaned.replace(/\n/g, " "), extra: [] };
  }
  return { main: main ?? cleaned.replace(/\n/g, " "), extra };
}
