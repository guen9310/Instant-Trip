import { tourFetch, extractItems } from "@/lib/tour/client";
import { readCache, writeCache, writeCacheEmpty, CACHE_EMPTY } from "@/lib/tour/cache";
import { ENDPOINTS } from "@/lib/tour/endpoints";
import type { TourDetailCommon, TourImage } from "@/lib/tour/types";
// PhotoGalleryService1은 키워드/위치 검색 미지원 — 장소별 이미지 fallback 불가
import type {
  PlaceCandidate,
  CoursePlace,
  CourseResult,
  UserProfile,
  PlaceOrigin,
} from "@/lib/pipeline/types";
import { TTL } from "@/lib/cache/ttl";

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function toShortAddress(addr1: string): string {
  return addr1
    .replace("특별시", "")
    .replace("광역시", "")
    .replace("특별자치도", "")
    .replace("특별자치시", "")
    .split(" ")
    .slice(0, 2)
    .join(" ");
}

// 장소의 이미지 목록을 가져온다.
// firstimage가 있으면 detailImage2 API를 호출하지 않고 바로 반환한다.
// firstimage가 없을 때만 API를 호출해서 등록된 이미지 목록을 가져온다.
// 결과는 7일간 파일 캐시에 저장해서 반복 호출을 방지한다.
export async function fetchImages(
  contentId: string,
  firstimage?: string,
): Promise<string[]> {
  // firstimage가 있으면 API 호출 없이 바로 반환한다.
  if (firstimage) {
    return [firstimage];
  }

  const cacheKey = `tour:detailImage2:${contentId}`;
  const cached = await readCache<string[]>(cacheKey);
  // detailImage2는 빈 배열([])로 캐시하므로 CACHE_EMPTY는 도달하지 않지만,
  // 타입 안전성을 위해 명시적으로 제외한다.
  if (cached !== null && cached !== CACHE_EMPTY) {
    console.log(
      `[stage5]   detailImage2(${contentId}) → 캐시 HIT (${cached.length}장)`,
    );
    return cached;
  }
  const ts = Date.now();
  try {
    const data = await tourFetch<TourImage>(ENDPOINTS.DETAIL_IMAGE, {
      contentId,
    });
    const imgs = extractItems(data)
      .filter((img) => img.originimgurl)
      .map((img) => img.originimgurl);
    const ttl = imgs.length === 0 ? TTL.EMPTY_RESULT : TTL.DETAIL_IMAGE;
    await writeCache(cacheKey, imgs, ttl);
    console.log(
      `[stage5]   detailImage2(${contentId}) → ${imgs.length}장 (${Date.now() - ts}ms)`,
    );
    return imgs;
  } catch (err) {
    console.warn(
      `[stage5]   detailImage2(${contentId}) 실패 (${Date.now() - ts}ms) — ${err}`,
    );
    return [];
  }
}

// 장소의 상세 정보(overview)를 가져온다.
// overview는 장소 소개글로, HTML 태그를 포함한 긴 텍스트다.
// 결과는 7일간 파일 캐시에 저장해서 반복 호출을 방지한다.
export async function fetchDetail(
  contentId: string,
): Promise<TourDetailCommon | null> {
  const cacheKey = `tour:detailCommon2:${contentId}`;
  const cached = await readCache<TourDetailCommon>(cacheKey);
  if (cached === CACHE_EMPTY) {
    console.log(`[stage5]   detailCommon2(${contentId}) → 캐시 HIT (빈 응답)`);
    return null;
  }
  if (cached !== null) {
    console.log(`[stage5]   detailCommon2(${contentId}) → 캐시 HIT`);
    return cached;
  }
  const ts = Date.now();
  try {
    const data = await tourFetch<TourDetailCommon>(ENDPOINTS.DETAIL_COMMON, {
      contentId,
    });
    const detail = extractItems(data)[0] ?? null;
    if (detail) {
      await writeCache(cacheKey, detail, TTL.DETAIL_COMMON);
    } else {
      await writeCacheEmpty(cacheKey, TTL.EMPTY_RESULT);
    }
    const hasOverview = !!detail?.overview;
    console.log(
      `[stage5]   detailCommon2(${contentId}) → overview:${hasOverview ? "있음" : "없음"} (${Date.now() - ts}ms)`,
    );
    return detail;
  } catch (err) {
    console.warn(
      `[stage5]   detailCommon2(${contentId}) 실패 (${Date.now() - ts}ms) — ${err}`,
    );
    return null;
  }
}

// 선택된 후보의 상세 정보(이미지·소개글)를 가져와 CoursePlace로 변환한다.
// profile/stage1~4 산출물에 의존하지 않고 candidate(+label) 하나로 완결되므로,
// 추천 파이프라인(assembleCourse)과 장소 선택 진입(generateCourseFromPlace) 양쪽이
// 이 함수 하나를 공유한다 — origin으로 호출부를 구분한다(기본값은 기존 동작과 동일한 "recommended").
export async function buildCoursePlace(
  candidate: PlaceCandidate,
  label: string,
  origin: PlaceOrigin = "recommended",
): Promise<CoursePlace> {
  const { item } = candidate;
  const ts = Date.now();
  const lat = parseFloat(item.mapy);
  const lng = parseFloat(item.mapx);

  // Kakao 출처 장소는 TourAPI 상세 조회 불가 — 스킵하고 정규화 시 수집한 필드로 채운다
  if (item.source === "kakao") {
    console.log(`[stage5] ${label} "${item.title}" — kakao 출처, 상세 조회 스킵`);
    return {
      contentId: item.contentid,
      contentTypeId: item.contenttypeid,
      title: item.title,
      address: item.addr1,
      shortAddress: toShortAddress(item.addr1),
      overview: "",
      images: [],
      coord: !isNaN(lat) && !isNaN(lng) ? { lat, lng } : null,
      tags: candidate.tags,
      score: candidate.score,
      availabilityUncertain: candidate.availabilityUncertain,
      estimatedDuration: candidate.estimatedDuration,
      stayDurationKey: candidate.stayDurationKey,
      origin,
    };
  }

  console.log(`[stage5] ${label} "${item.title}" 상세 조회 시작`);

  const [images, detail] = await Promise.all([
    item.firstimage
      ? Promise.resolve([item.firstimage])
      : fetchImages(item.contentid),
    fetchDetail(item.contentid),
  ]);

  console.log(
    `[stage5] ${label} "${item.title}" 완료 — 이미지:${images.length}장 / 개요:${detail?.overview ? detail.overview.length + "자" : "없음"} (${Date.now() - ts}ms)`,
  );

  return {
    contentId: item.contentid,
    contentTypeId: item.contenttypeid,
    title: item.title,
    address: item.addr1,
    shortAddress: toShortAddress(item.addr1),
    overview: detail?.overview ? stripHtml(detail.overview) : "",
    images,
    coord: !isNaN(lat) && !isNaN(lng) ? { lat, lng } : null,
    tags: candidate.tags,
    score: candidate.score,
    availabilityUncertain: candidate.availabilityUncertain,
    estimatedDuration: candidate.estimatedDuration,
    stayDurationKey: candidate.stayDurationKey,
    origin,
  };
}

// [stage5] stage4 점수 1위 후보를 메인 장소로 채택한다.
//
// 이전에는 사용자 위치 근접도를 0.25 가중으로 재반영해 점수 순위를 뒤집는 로직이 있었으나,
// distanceBonus(stage4, scoring.ts)가 이미 같은 신호(거리)를 0.25 가중으로 반영하고 있어
// 사실상 거리를 두 번 반영하는 구조였다. 후보가 희소한 지역에서 점수 12위가 1위를 제치는
// 사례가 실측으로 확인되어(2026-06-27) 제거했다. distanceBonus 하나로 충분하다.
export async function assembleCourse(
  scored: PlaceCandidate[],
  profile: UserProfile,
): Promise<Omit<CourseResult, "festivals" | "recommended_food">> {
  const t0 = Date.now();

  if (scored.length === 0) {
    return {
      mainPlace: null,
      nearbyPlaces: [],
      scale: profile.scale,
      generatedAt: new Date().toISOString(),
    };
  }

  const mainCandidate = scored[0];
  console.log(`[stage5] 메인 장소: "${mainCandidate.item.title}"`);

  const mainPlace = await buildCoursePlace(mainCandidate, "[메인]");

  console.log(
    `[stage5] 완료 — 메인 1곳 (총 ${Date.now() - t0}ms)\n` +
      `[stage5] 수집된 코스:\n  메인. [${mainPlace.contentTypeId}] ${mainPlace.title} | ${mainPlace.shortAddress} | 이미지 ${mainPlace.images.length}장 | score ${mainPlace.score.toFixed(3)}`,
  );

  return {
    mainPlace,
    nearbyPlaces: [],
    scale: profile.scale,
    generatedAt: new Date().toISOString(),
  };
}
