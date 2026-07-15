import { tourFetch, extractItems, sleep } from "@/lib/tour/client";
import { getCachedSWR, setCached, CACHE_EMPTY } from "@/lib/cache/dbCache";
import { TTL } from "@/lib/cache/ttl";
import { getKstDateYYYYMMDD } from "@/shared/utils/kst";

export interface TourFestivalItem {
  contentid: string;
  contenttypeid: string;
  title: string;
  addr1: string;
  addr2: string;
  mapx: string;   // 경도
  mapy: string;   // 위도
  firstimage: string;
  firstimage2: string;
  areacode: string;
  sigungucode: string;
  eventstartdate: string;  // YYYYMMDD
  eventenddate: string;    // YYYYMMDD
  cat1: string;
  cat2: string;
  cat3: string;
  tel: string;
}

const CACHE_KEY = "tour:searchFestival2:all";
// 오늘-30일로 걸어야 어제 시작해 오늘 진행 중인 축제까지 커버된다.
const ONGOING_LOOKBACK_DAYS = 30;
const PAGE_SIZE = 100;
const MAX_PAGES = 20; // 최대 2000건

// 캐시 만료 직후 동시 요청이 몰릴 때 페이지 순회가 중복 실행되지 않도록 진행 중인
// Promise를 공유한다. stale 백그라운드 갱신과 cron 강제 갱신도 이 함수를 공유해서
// 중복 실행을 막는다.
let _inflight: Promise<TourFestivalItem[]> | null = null;

// searchFestival2 전체 페이지를 순회 수집하고 캐시에 기록한다.
export function fetchAndCacheTourFestivals(): Promise<TourFestivalItem[]> {
  if (_inflight) return _inflight;

  _inflight = (async () => {
    const t0 = Date.now();
    const base = new Date();
    base.setDate(base.getDate() - ONGOING_LOOKBACK_DAYS);
    const eventStartDate = getKstDateYYYYMMDD(base);

    const all: TourFestivalItem[] = [];
    for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
      const data = await tourFetch<TourFestivalItem>("searchFestival2", {
        eventStartDate,
        arrange: "A",
        numOfRows: PAGE_SIZE,
        pageNo,
      });
      const items = extractItems(data);
      all.push(...items);
      const totalCount = data.response.body.totalCount;
      if (all.length >= totalCount || items.length === 0 || items.length < PAGE_SIZE) break;
      await sleep(300);
    }
    console.log(`[searchFestival2] 수집 완료 — ${all.length}건 (${Date.now() - t0}ms)`);
    const ttl = all.length === 0 ? TTL.EMPTY_RESULT : TTL.TOUR_FESTIVAL;
    await setCached(CACHE_KEY, all, ttl);
    return all;
  })().finally(() => { _inflight = null; });

  return _inflight;
}

export async function getAllTourFestivals(): Promise<TourFestivalItem[]> {
  const cached = await getCachedSWR<TourFestivalItem[]>(CACHE_KEY);

  if (cached.freshness === "fresh") {
    const value = cached.value === CACHE_EMPTY ? [] : cached.value;
    console.log(`[searchFestival2] 캐시 HIT(fresh) — ${value.length}건`);
    return value;
  }

  if (cached.freshness === "stale") {
    const value = cached.value === CACHE_EMPTY ? [] : cached.value;
    console.log(`[searchFestival2] 캐시 HIT(stale) — ${value.length}건, 즉시 반환 + 백그라운드 갱신 트리거`);
    fetchAndCacheTourFestivals().catch((err) => {
      console.warn(`[searchFestival2] 백그라운드 갱신 실패 — ${err}`);
    });
    return value;
  }

  console.log(`[searchFestival2] 캐시 MISS — 동기 수집`);
  return fetchAndCacheTourFestivals();
}
