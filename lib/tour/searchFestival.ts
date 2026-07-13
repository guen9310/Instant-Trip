import { tourFetch, extractItems, sleep } from "@/lib/tour/client";
import { getCached, setCached, CACHE_EMPTY } from "@/lib/cache/dbCache";
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

let _inflight: Promise<TourFestivalItem[]> | null = null;

export async function getAllTourFestivals(): Promise<TourFestivalItem[]> {
  const cached = await getCached<TourFestivalItem[]>(CACHE_KEY);
  if (cached !== null && cached !== CACHE_EMPTY) {
    console.log(`[searchFestival2] 캐시 HIT — ${cached.length}건`);
    return cached;
  }

  if (_inflight) return _inflight;

  _inflight = (async () => {
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
      console.log(`[searchFestival2] 페이지 ${pageNo} — ${items.length}건`);
      all.push(...items);
      const totalCount = data.response.body.totalCount;
      if (all.length >= totalCount || items.length === 0 || items.length < PAGE_SIZE) break;
      await sleep(300);
    }
    console.log(`[searchFestival2] 전체 로드 완료 — ${all.length}건`);
    const ttl = all.length === 0 ? TTL.EMPTY_RESULT : TTL.TOUR_FESTIVAL;
    await setCached(CACHE_KEY, all, ttl);
    return all;
  })().finally(() => { _inflight = null; });

  return _inflight;
}
