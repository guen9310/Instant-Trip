import { tourFetch, extractItems } from "@/lib/tour/client";
import { readCache, writeCache, writeCacheEmpty, CACHE_EMPTY } from "@/lib/tour/cache";
import { ENDPOINTS } from "@/lib/tour/endpoints";
import type { TourItem } from "@/lib/tour/types";
import { TTL } from "@/lib/cache/ttl";

// A=제목순, C=수정일순, D=생성일순, R=인기순
export type AreaArrange = "A" | "C" | "D" | "R";

export async function fetchAreaBasedList(
  areaCode: string,
  contentTypeId: string,
  arrange: AreaArrange = "R",
  page = 1,
  numOfRows = 10,
): Promise<TourItem[]> {
  const cacheKey = `tour:areaBasedList2:${areaCode}:${contentTypeId}:${arrange}:${page}`;

  const cached = await readCache<TourItem[]>(cacheKey);
  if (cached === CACHE_EMPTY) {
    console.log(`[areaBasedList2] 캐시 EMPTY — areaCode=${areaCode} type=${contentTypeId}`);
    return [];
  }
  if (cached !== null) {
    console.log(`[areaBasedList2] 캐시 HIT — areaCode=${areaCode} type=${contentTypeId} (${cached.length}건)`);
    return cached;
  }

  try {
    const data = await tourFetch<TourItem>(ENDPOINTS.AREA_BASED_LIST, {
      areaCode,
      contentTypeId,
      arrange,
      numOfRows,
      pageNo: page,
    });
    const items = extractItems(data);
    if (items.length === 0) {
      await writeCacheEmpty(cacheKey, TTL.EMPTY_RESULT);
    } else {
      await writeCache(cacheKey, items, TTL.AREA_BASED_LIST);
    }
    console.log(`[areaBasedList2] areaCode=${areaCode} type=${contentTypeId} → ${items.length}건`);
    return items;
  } catch (err) {
    console.warn(`[areaBasedList2] 조회 실패 — areaCode=${areaCode} type=${contentTypeId} — ${err}`);
    return [];
  }
}
