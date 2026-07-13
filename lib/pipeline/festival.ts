import { fetchCulturalFestivals } from "@/lib/clients/cultural-festival";
import type { CulturalFestival } from "@/lib/clients/cultural-festival";
import { getAllTourFestivals } from "@/lib/tour/searchFestival";
import { mergeFestivals } from "@/lib/pipeline/festivalMerge";
import { haversineKm } from "@/shared/utils/geo";
import { getKstDateString } from "@/shared/utils/kst";
import { getCached, setCached, CACHE_EMPTY } from "@/lib/cache/dbCache";
import { TTL } from "@/lib/cache/ttl";

// 공공데이터포털 전용 캐시 키 (병합 전 원본)
const PUBLIC_CACHE_KEY = "tour:festival:public:all";

// 한 번에 최대 1000건까지만 허용되는 API라(2026-06-29 확인: 1290건↑ 시도 시
// INVALID_REQUEST_PARAMETER_ERROR), 전체를 받으려면 페이지를 순회해야 한다.
// 마지막 페이지가 PAGE_SIZE보다 적게 돌아오면 끝으로 본다(totalCount에 의존하지 않음).
const FESTIVAL_PAGE_SIZE = 1000;
const FESTIVAL_MAX_PAGES = 5; // 안전판 — 최대 5000건까지

// 캐시 만료 직후 동시 요청이 몰릴 때 페이지 순회가 중복 실행되지 않도록 진행 중인
// Promise를 공유한다. 완료(성공·실패 모두)되면 null로 초기화한다.
let _publicInflight: Promise<CulturalFestival[]> | null = null;

async function getAllPublicFestivals(): Promise<CulturalFestival[]> {
  const cached = await getCached<CulturalFestival[]>(PUBLIC_CACHE_KEY);
  if (cached !== null && cached !== CACHE_EMPTY) {
    console.log(`[festival:public] 캐시 HIT — ${cached.length}건`);
    return cached;
  }

  if (_publicInflight) return _publicInflight;

  _publicInflight = (async () => {
    const all: CulturalFestival[] = [];
    for (let pageNo = 1; pageNo <= FESTIVAL_MAX_PAGES; pageNo++) {
      const page = await fetchCulturalFestivals({ pageNo, numOfRows: FESTIVAL_PAGE_SIZE });
      console.log(`[festival:public] API 페이지 ${pageNo} — ${page.length}건`);
      all.push(...page);
      if (page.length < FESTIVAL_PAGE_SIZE) break;
    }
    console.log(`[festival:public] 전체 로드 완료 — ${all.length}건`);
    const ttl = all.length === 0 ? TTL.EMPTY_RESULT : TTL.FESTIVAL;
    await setCached(PUBLIC_CACHE_KEY, all, ttl);
    return all;
  })().finally(() => { _publicInflight = null; });

  return _publicInflight;
}

// 두 소스를 병렬 수신 후 병합. 한쪽 실패 시 나머지 단독으로 진행.
export async function getAllFestivals(): Promise<CulturalFestival[]> {
  const [publicResult, tourResult] = await Promise.allSettled([
    getAllPublicFestivals(),
    getAllTourFestivals(),
  ]);

  const publicFestivals = publicResult.status === "fulfilled" ? publicResult.value : [];
  const tourFestivals = tourResult.status === "fulfilled" ? tourResult.value : [];

  if (publicResult.status === "rejected") {
    console.warn(`[festival] 공공데이터포털 조회 실패 — ${publicResult.reason}`);
  }
  if (tourResult.status === "rejected") {
    console.warn(`[festival] searchFestival2 조회 실패 — ${tourResult.reason}`);
  }

  const { festivals, stats } = mergeFestivals(publicFestivals, tourFestivals);
  console.log(
    `[festival] 병합 완료 — 공공 ${stats.publicCount}건 / Tour ${stats.tourCount}건 / 매칭 ${stats.matchedCount}쌍 / 이미지 ${stats.imageCount}건 / 총 ${festivals.length}건`,
  );
  return festivals;
}

// 시작~종료가 이 일수를 초과하면 상설 프로그램으로 간주하고 축제 섹션에서 제외
export const FESTIVAL_MAX_DURATION_DAYS = 90;
// 예정 축제 노출 창: 오늘 기준 이 일수 이내 시작하는 축제만 표시
export const FESTIVAL_UPCOMING_WINDOW_DAYS = 14;

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
  const upcomingLimitDate = new Date(base);
  upcomingLimitDate.setDate(upcomingLimitDate.getDate() + FESTIVAL_UPCOMING_WINDOW_DAYS);
  const limitDate = getKstDateString(upcomingLimitDate);

  // 1단계: 기간 필터 — 90일 초과는 상설 프로그램으로 간주하고 제외
  const MAX_DURATION_MS = FESTIVAL_MAX_DURATION_DAYS * 24 * 60 * 60 * 1000;
  const durationPassed = all.filter((f) => {
    const durationMs =
      new Date(f.fstvlEndDate).getTime() - new Date(f.fstvlStartDate).getTime();
    return durationMs <= MAX_DURATION_MS;
  });
  if (durationPassed.length < all.length) {
    console.log(
      `[festival:filter] 기간(>${FESTIVAL_MAX_DURATION_DAYS}일) 제외 — ${all.length - durationPassed.length}건 제외, ${durationPassed.length}건 통과`,
    );
  }

  // 2단계: 반경 필터
  const { location } = options;
  const distKm = (f: CulturalFestival) =>
    location ? haversineKm(location.lat, location.lng, f.latitude, f.longitude) : 0;
  const radiusPassed = location
    ? durationPassed.filter((f) => {
        if (isNaN(f.latitude) || isNaN(f.longitude)) return false;
        return distKm(f) <= location.radiusKm;
      })
    : durationPassed;
  if (location && radiusPassed.length < durationPassed.length) {
    console.log(
      `[festival:filter] 반경(>${location.radiusKm}km) 제외 — ${durationPassed.length - radiusPassed.length}건 제외, ${radiusPassed.length}건 통과`,
    );
  }

  // 3단계: 진행중/예정 분류
  const ongoing = radiusPassed.filter(
    (f) => f.fstvlStartDate <= today && f.fstvlEndDate >= today,
  );
  const upcomingAll = radiusPassed.filter((f) => f.fstvlStartDate > today);
  const upcoming = upcomingAll.filter((f) => f.fstvlStartDate <= limitDate);
  const windowExcluded = upcomingAll.length - upcoming.length;
  if (windowExcluded > 0) {
    console.log(
      `[festival:filter] 예정창(${FESTIVAL_UPCOMING_WINDOW_DAYS}일 초과) 제외 — ${windowExcluded}건 제외, ${upcoming.length}건 통과`,
    );
  }

  // 진행중은 거리 오름차순, 예정은 시작일 오름차순
  const sortedOngoing = location
    ? [...ongoing].sort((a, b) => distKm(a) - distKm(b))
    : [...ongoing].sort((a, b) => a.fstvlStartDate.localeCompare(b.fstvlStartDate));
  const sortedUpcoming = [...upcoming].sort((a, b) =>
    a.fstvlStartDate.localeCompare(b.fstvlStartDate),
  );

  return { ongoing: sortedOngoing, upcoming: sortedUpcoming };
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
