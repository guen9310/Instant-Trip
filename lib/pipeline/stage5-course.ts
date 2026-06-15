import { tourFetch, extractItems } from "@/lib/tour/client";
import { readCache, writeCache } from "@/lib/tour/cache";
import { ENDPOINTS } from "@/lib/tour/endpoints";
import type { TourItem, TourDetailCommon, TourImage } from "@/lib/tour/types";
// PhotoGalleryService1은 키워드/위치 검색 미지원 — 장소별 이미지 fallback 불가
import type { PlaceCandidate, CoursePlace, CourseResult, UserProfile } from "@/lib/pipeline/types";
import type { CulturalFestival } from "@/lib/clients/cultural-festival";
import { SCALE_CONFIG } from "@/lib/pipeline/types";
import { haversineKm } from "@/lib/pipeline/stage4-scoring";

// 이미지와 상세 정보는 자주 바뀌지 않으므로 7일간 캐시한다.
const IMAGE_TTL  = 7 * 24 * 60 * 60 * 1000; // 7일
const DETAIL_TTL = 7 * 24 * 60 * 60 * 1000; // 7일

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n").trim();
}

export function toShortAddress(addr1: string): string {
  return addr1
    .replace("특별시", "").replace("광역시", "")
    .replace("특별자치도", "").replace("특별자치시", "")
    .split(" ").slice(0, 2).join(" ");
}

// 현재 위치에서 후보까지의 근접도를 0~1로 반환한다. 좌표가 없으면 0.
function calcProximityBonus(mapy: string, mapx: string, curLat: number, curLng: number, radiusM: number): number {
  const lat = parseFloat(mapy);
  const lng = parseFloat(mapx);
  if (isNaN(lat) || isNaN(lng) || radiusM <= 0) return 0;
  const radiusDeg = radiusM / 111_000;
  const distDeg = Math.sqrt((lat - curLat) ** 2 + (lng - curLng) ** 2);
  return Math.max(0, 1 - distDeg / radiusDeg);
}

const ROUTE_WEIGHT = 0.25;
const CANDIDATE_POOL = 20;

// 장소의 이미지 목록을 가져온다.
// firstimage가 있으면 detailImage2 API를 호출하지 않고 바로 반환한다.
// firstimage가 없을 때만 API를 호출해서 등록된 이미지 목록을 가져온다.
// 결과는 7일간 파일 캐시에 저장해서 반복 호출을 방지한다.
export async function fetchImages(contentId: string, firstimage?: string): Promise<string[]> {
  // firstimage가 있으면 API 호출 없이 바로 반환한다.
  if (firstimage) {
    return [firstimage];
  }

  const cacheKey = `img_${contentId}`;
  const cached = readCache<string[]>(cacheKey, IMAGE_TTL);
  if (cached) {
    console.log(`[stage5]   detailImage2(${contentId}) → 캐시 hit (${cached.length}장)`);
    return cached;
  }
  const ts = Date.now();
  try {
    const data = await tourFetch<TourImage>(ENDPOINTS.DETAIL_IMAGE, { contentId });
    const imgs = extractItems(data).filter((img) => img.originimgurl).map((img) => img.originimgurl);
    writeCache(cacheKey, imgs);
    console.log(`[stage5]   detailImage2(${contentId}) → ${imgs.length}장 (${Date.now() - ts}ms)`);
    return imgs;
  } catch (err) {
    console.warn(`[stage5]   detailImage2(${contentId}) 실패 (${Date.now() - ts}ms) — ${err}`);
    return [];
  }
}

// 장소의 상세 정보(overview)를 가져온다.
// overview는 장소 소개글로, HTML 태그를 포함한 긴 텍스트다.
// 결과는 7일간 파일 캐시에 저장해서 반복 호출을 방지한다.
export async function fetchDetail(contentId: string): Promise<TourDetailCommon | null> {
  const cacheKey = `detail_${contentId}`;
  const cached = readCache<TourDetailCommon>(cacheKey, DETAIL_TTL);
  if (cached) {
    console.log(`[stage5]   detailCommon2(${contentId}) → 캐시 hit`);
    return cached;
  }
  const ts = Date.now();
  try {
    const data = await tourFetch<TourDetailCommon>(ENDPOINTS.DETAIL_COMMON, { contentId });
    const detail = extractItems(data)[0] ?? null;
    if (detail) writeCache(cacheKey, detail);
    const hasOverview = !!detail?.overview;
    console.log(`[stage5]   detailCommon2(${contentId}) → overview:${hasOverview ? "있음" : "없음"} (${Date.now() - ts}ms)`);
    return detail;
  } catch (err) {
    console.warn(`[stage5]   detailCommon2(${contentId}) 실패 (${Date.now() - ts}ms) — ${err}`);
    return null;
  }
}


const FESTIVAL_IMG_TTL = 24 * 60 * 60 * 1000; // 24시간

// 축제명으로 searchKeyword2를 호출해 firstimage를 가져온다.
// Tour API contenttypeid=15 데이터는 정확도가 낮지만 이미지 조회 용도로는 충분하다.
export async function fetchFestivalImage(fstvlNm: string): Promise<string[]> {
  const cacheKey = `festival_img_${fstvlNm.replace(/\s+/g, "_")}`;
  const cached = readCache<string[]>(cacheKey, FESTIVAL_IMG_TTL);
  if (cached !== null) return cached;

  // 연도 접두사 제거 ("2026 태화강마두희축제" → "태화강마두희축제")
  // 공공데이터 축제명에는 연도가 붙지만 Tour API에는 연도 없이 등록된 경우가 많다.
  const keyword = fstvlNm.replace(/^\d{4}\s+/, "");

  try {
    const data = await tourFetch<TourItem>(ENDPOINTS.SEARCH_KEYWORD, {
      keyword,
      numOfRows: "5",
    });
    const items = extractItems(data);
    const first = items.find(i => i.contentid);
    if (!first) {
      writeCache(cacheKey, []);
      return [];
    }
    // contentid로 detailImage2를 호출해 전체 이미지 목록을 가져온다.
    const images = await fetchImages(first.contentid);
    writeCache(cacheKey, images);
    return images;
  } catch {
    return [];
  }
}

export function festivalToPlace(festival: CulturalFestival, images: string[] = []): CoursePlace {
  const addr = festival.rdnmadr || festival.lnmadr || "";
  const id = `festival_${festival.fstvlStartDate}_${festival.fstvlNm}`;
  return {
    contentId: id,
    contentTypeId: "festival",
    title: festival.fstvlNm,
    address: addr,
    shortAddress: toShortAddress(addr),
    overview: festival.fstvlCo || "",
    images,
    coord: { lat: festival.latitude, lng: festival.longitude },
    tags: [],
    score: 1.0,
  };
}

// [stage5] 점수화된 후보 중 최종 장소를 선택하고 코스를 조립한다.
//
// 처리 순서:
// 1. 선택 + 동선 최적화: selectWithRouteAndDiversity로 행사 우선 배치 후
//    그리디 방식으로 (점수 + 현재 위치 근접도)를 조합해 순서대로 장소를 선택한다.
// 2. 상세 정보 수집: 선택된 장소의 이미지와 소개글을 병렬로 가져온다.
//
// - 반환값: 방문 순서로 정렬된 CoursePlace 배열을 담은 CourseResult
async function buildCoursePlace(candidate: PlaceCandidate, label: string): Promise<CoursePlace> {
  const { item } = candidate;
  const ts = Date.now();
  console.log(`[stage5] ${label} "${item.title}" 상세 조회 시작`);

  const [images, detail] = await Promise.all([
    item.firstimage ? Promise.resolve([item.firstimage]) : fetchImages(item.contentid),
    fetchDetail(item.contentid),
  ]);

  const lat = parseFloat(item.mapy);
  const lng = parseFloat(item.mapx);
  console.log(
    `[stage5] ${label} "${item.title}" 완료 — 이미지:${images.length}장 / 개요:${detail?.overview ? detail.overview.length + "자" : "없음"} (${Date.now() - ts}ms)`,
  );

  return {
    contentId: item.contentid,
    contentTypeId: item.contenttypeid,
    title: item.title,
    address: item.addr1,
    shortAddress: toShortAddress(item.addr1),
    overview: detail?.overview ? stripHtml(detail.overview).slice(0, 300) : "",
    images,
    coord: !isNaN(lat) && !isNaN(lng) ? { lat, lng } : null,
    tags: candidate.tags,
    score: candidate.score,
  };
}

// [stage5] 메인 장소 1곳 선택 + 메인 장소 기준 2km 이내 연계 장소 최대 1곳 제안
export async function assembleCourse(
  scored: PlaceCandidate[],
  profile: UserProfile,
): Promise<Omit<CourseResult, "festivals" | "recommended_food">> {
  const t0 = Date.now();

  if (scored.length === 0) {
    return { mainPlace: null, nearbyPlaces: [], scale: profile.scale, generatedAt: new Date().toISOString() };
  }

  const { radius } = SCALE_CONFIG[profile.scale];
  const startLat = profile.location.mapY;
  const startLng = profile.location.mapX;

  // 사용자 위치 기준 근접도 가중 점수로 메인 장소 1곳 선택
  const pool = scored.slice(0, CANDIDATE_POOL);
  let bestScore = -Infinity;
  let bestIdx = 0;
  for (let i = 0; i < pool.length; i++) {
    const c = pool[i];
    const proximity = calcProximityBonus(c.item.mapy, c.item.mapx, startLat, startLng, radius);
    const combined = c.score * (1 - ROUTE_WEIGHT) + proximity * ROUTE_WEIGHT;
    if (combined > bestScore) { bestScore = combined; bestIdx = i; }
  }

  const mainCandidate = scored[bestIdx];
  console.log(`[stage5] 메인 장소: "${mainCandidate.item.title}"`);

  const mainPlace = await buildCoursePlace(mainCandidate, "[메인]");

  // 메인 장소 기준 2km 이내 후보를 nearbyPool로 구성한다.
  const NEARBY_RADIUS_KM = 2.0;
  const mainLat = parseFloat(mainCandidate.item.mapy);
  const mainLng = parseFloat(mainCandidate.item.mapx);

  const nearbyPool = scored.filter((c, i) => {
    if (i === bestIdx) return false;
    const lat = parseFloat(c.item.mapy);
    const lng = parseFloat(c.item.mapx);
    if (isNaN(lat) || isNaN(lng) || isNaN(mainLat) || isNaN(mainLng)) return false;
    const distKm = haversineKm(mainLat, mainLng, lat, lng);
    return distKm <= NEARBY_RADIUS_KM;
  });

  console.log(`[stage5] 연계 후보 (2km 이내): ${nearbyPool.length}곳`);

  // 메인과 cat2가 다른 후보를 우선 선택해 다양성을 확보한다.
  const mainCat2 = mainCandidate.item.cat2;
  const nearbySelected: PlaceCandidate[] = [];

  for (const c of nearbyPool) {
    if (nearbySelected.length >= 1) break;
    if (c.item.cat2 !== mainCat2) nearbySelected.push(c);
  }

  // cat2 다양성 조건으로 1곳을 채우지 못한 경우 조건을 완화한다.
  if (nearbySelected.length < 1) {
    for (const c of nearbyPool) {
      if (nearbySelected.length >= 1) break;
      if (!nearbySelected.includes(c)) nearbySelected.push(c);
    }
  }

  console.log(`[stage5] 연계 장소 선택: 최대 1곳 → ${nearbySelected.length}곳`);

  const nearbyPlaces = await Promise.all(
    nearbySelected.map((c, i) => buildCoursePlace(c, `[연계${i + 1}]`)),
  );

  console.log(`[stage5] 완료 — 메인 1곳 + 연계 ${nearbyPlaces.length}곳 (총 ${Date.now() - t0}ms)`);

  return {
    mainPlace,
    nearbyPlaces,
    scale: profile.scale,
    generatedAt: new Date().toISOString(),
  };
}
