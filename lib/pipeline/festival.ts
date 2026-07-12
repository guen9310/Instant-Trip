import { fetchCulturalFestivals } from "@/lib/clients/cultural-festival";
import type { CulturalFestival } from "@/lib/clients/cultural-festival";
import { haversineKm } from "@/shared/utils/geo";
import { getKstDateString } from "@/shared/utils/kst";
import { getCached, setCached, CACHE_EMPTY } from "@/lib/cache/dbCache";
import { TTL } from "@/lib/cache/ttl";

const FESTIVAL_CACHE_KEY = "tour:festival:all";

// 한 번에 최대 1000건까지만 허용되는 API라(2026-06-29 확인: 1290건↑ 시도 시
// INVALID_REQUEST_PARAMETER_ERROR), 전체를 받으려면 페이지를 순회해야 한다.
// 마지막 페이지가 PAGE_SIZE보다 적게 돌아오면 끝으로 본다(totalCount에 의존하지 않음).
const FESTIVAL_PAGE_SIZE = 1000;
const FESTIVAL_MAX_PAGES = 5; // 안전판 — 최대 5000건까지

// 캐시 만료 직후 동시 요청이 몰릴 때 페이지 순회가 중복 실행되지 않도록 진행 중인
// Promise를 공유한다. 완료(성공·실패 모두)되면 null로 초기화한다.
let _inflight: Promise<CulturalFestival[]> | null = null;

export async function getAllFestivals(): Promise<CulturalFestival[]> {
  const cached = await getCached<CulturalFestival[]>(FESTIVAL_CACHE_KEY);
  // 축제 API는 빈 배열([])로 캐시하므로 CACHE_EMPTY는 도달하지 않지만 타입 정합 처리
  if (cached !== null && cached !== CACHE_EMPTY) {
    console.log(`[festival] 캐시 HIT — ${cached.length}건`);
    return cached;
  }

  if (_inflight) return _inflight;

  _inflight = (async () => {
    const all: CulturalFestival[] = [];
    for (let pageNo = 1; pageNo <= FESTIVAL_MAX_PAGES; pageNo++) {
      const page = await fetchCulturalFestivals({ pageNo, numOfRows: FESTIVAL_PAGE_SIZE });
      console.log(`[festival] API 페이지 ${pageNo} — ${page.length}건`);
      all.push(...page);
      if (page.length < FESTIVAL_PAGE_SIZE) break;
    }
    console.log(`[festival] 전체 로드 완료 — ${all.length}건`);
    const ttl = all.length === 0 ? TTL.EMPTY_RESULT : TTL.FESTIVAL;
    await setCached(FESTIVAL_CACHE_KEY, all, ttl);
    return all;
  })().finally(() => { _inflight = null; });

  return _inflight;
}

type SplitOptions = {
  simulationDate?: string;
  affinity?: number;
  location?: { lat: number; lng: number; radiusKm: number };
};

function splitOngoingUpcoming(
  all: CulturalFestival[],
  options: SplitOptions,
): { ongoing: CulturalFestival[]; upcoming: CulturalFestival[] } {
  const base = options.simulationDate
    ? new Date(options.simulationDate)
    : new Date();
  const today = getKstDateString(base);
  const oneMonthLater = new Date(base);
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
  const limitDate = getKstDateString(oneMonthLater);

  const { location } = options;
  const distKm = (f: CulturalFestival) =>
    location ? haversineKm(location.lat, location.lng, f.latitude, f.longitude) : 0;
  const inRadius = (f: CulturalFestival) => {
    if (!location) return true; // 위치 미지정 — 반경 필터링 없이 전국 대상
    if (isNaN(f.latitude) || isNaN(f.longitude)) return false;
    return distKm(f) <= location.radiusKm;
  };

  const ongoing = all.filter(
    (f) => f.fstvlStartDate <= today && f.fstvlEndDate >= today && inRadius(f),
  );
  const upcoming = all.filter(
    (f) =>
      f.fstvlStartDate > today &&
      f.fstvlStartDate <= limitDate &&
      inRadius(f),
  );

  // 실외 친화(affinity >= 0.6) + 위치가 있으면 거리순, 그 외엔 시작일순
  const affinity = options.affinity ?? 0;
  const sort = (list: CulturalFestival[]) =>
    affinity >= 0.6 && location
      ? [...list].sort((a, b) => distKm(a) - distKm(b))
      : [...list].sort((a, b) => a.fstvlStartDate.localeCompare(b.fstvlStartDate));

  return { ongoing: sort(ongoing), upcoming: sort(upcoming) };
}

export async function fetchNearbyFestivals(
  lat: number,
  lng: number,
  radiusKm: number,
  options: { simulationDate?: string; affinity?: number } = {},
): Promise<{ ongoing: CulturalFestival[]; upcoming: CulturalFestival[] }> {
  try {
    const all = await getAllFestivals();
    const result = splitOngoingUpcoming(all, { ...options, location: { lat, lng, radiusKm } });
    console.log(
      `[festival] 반경 필터 — 중심: (${lat.toFixed(4)}, ${lng.toFixed(4)}), 반경: ${radiusKm}km | 전체 ${all.length}건 → 진행중 ${result.ongoing.length}건, 예정 ${result.upcoming.length}건`,
    );
    return result;
  } catch (err) {
    console.warn(`[festival] 문화축제 조회 실패 — ${err}`);
    return { ongoing: [], upcoming: [] };
  }
}

// 위치 없이 날짜 기준으로만 진행중/예정을 가른다 — REST 엔드포인트에서
// lat/lng가 생략된 "전국 데이터" 요청에 쓴다.
export async function fetchAllFestivalsByDate(
  options: { simulationDate?: string } = {},
): Promise<{ ongoing: CulturalFestival[]; upcoming: CulturalFestival[] }> {
  try {
    const all = await getAllFestivals();
    return splitOngoingUpcoming(all, options);
  } catch (err) {
    console.warn(`[festival] 문화축제 조회 실패 — ${err}`);
    return { ongoing: [], upcoming: [] };
  }
}
