import { fetchCulturalFestivals } from "@/lib/clients/cultural-festival";
import type { CulturalFestival } from "@/lib/clients/cultural-festival";
import { haversineKm } from "@/lib/pipeline/scoring";

// 원본 데이터를 1시간 메모리 캐시 — 같은 프로세스 내 호출(파이프라인·REST 엔드포인트
// 모두)이 이 캐시 하나를 공유한다. 별도 캐시를 또 두면 API가 중복 호출된다.
let _festivalCache: { data: CulturalFestival[]; cachedAt: number } | null =
  null;
const FESTIVAL_CACHE_TTL = 60 * 60 * 1000; // 1시간

// 한 번에 최대 1000건까지만 허용되는 API라(2026-06-29 확인: 1290건↑ 시도 시
// INVALID_REQUEST_PARAMETER_ERROR), 전체를 받으려면 페이지를 순회해야 한다.
// 마지막 페이지가 PAGE_SIZE보다 적게 돌아오면 끝으로 본다(totalCount에 의존하지 않음).
const FESTIVAL_PAGE_SIZE = 1000;
const FESTIVAL_MAX_PAGES = 5; // 안전판 — 최대 5000건까지

export async function getAllFestivals(): Promise<CulturalFestival[]> {
  if (
    _festivalCache &&
    Date.now() - _festivalCache.cachedAt < FESTIVAL_CACHE_TTL
  ) {
    return _festivalCache.data;
  }

  const all: CulturalFestival[] = [];
  for (let pageNo = 1; pageNo <= FESTIVAL_MAX_PAGES; pageNo++) {
    const page = await fetchCulturalFestivals({
      pageNo,
      numOfRows: FESTIVAL_PAGE_SIZE,
    });
    all.push(...page);
    if (page.length < FESTIVAL_PAGE_SIZE) break;
  }

  _festivalCache = { data: all, cachedAt: Date.now() };
  return all;
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
  const today = base.toISOString().slice(0, 10);
  const oneMonthLater = new Date(base);
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
  const limitDate = oneMonthLater.toISOString().slice(0, 10);

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
    return splitOngoingUpcoming(all, {
      ...options,
      location: { lat, lng, radiusKm },
    });
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
