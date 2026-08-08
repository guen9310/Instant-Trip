"use server";

import { resolveRegion, nearestRegion } from "@/shared/utils/regionMap";
import { fetchHomeCore } from "@/lib/home/core";
import {
  homeLocationInputSchema,
  homeRegionInputSchema,
} from "@/shared/schemas/actionInputs";

export async function getHomeDataAction(input: unknown) {
  const parsed = homeLocationInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid home location request");
  }
  const { lat, lng, city, sidoName } = parsed.data;

  // sidoName(시·도 레벨)을 우선 사용하고, 없으면 city(구 단위 가능)로 시도.
  // 지오코딩이 이름을 못 줬거나 매칭에 실패해도 좌표는 항상 있으므로, 가장 가까운
  // 시·도로 폴백해 places 조회가 region=null 때문에 통째로 비지 않게 한다.
  const region = resolveRegion(sidoName ?? city);
  if (!region) {
    console.log(
      `[home] resolveRegion 실패 — sidoName="${sidoName}" city="${city}" → 좌표 기반 최근접 지역으로 폴백`,
    );
  }
  return fetchHomeCore(lat, lng, region ?? nearestRegion(lat, lng));
}

// 위치 권한 거부 시 폴백 — 매핑 테이블의 대표 좌표로 동일한 데이터 반환
export async function getHomeDataByRegionAction(input: unknown) {
  const parsed = homeRegionInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid home region request");
  }
  const { regionName } = parsed.data;
  const region = resolveRegion(regionName);
  if (!region) {
    console.log(`[home] resolveRegion 실패 — regionName="${regionName}"`);
    return {
      region: null,
      places: [],
      ongoingFestivals: [],
      upcomingFestivals: [],
      errors: ["region", "places", "festivals"],
    };
  }
  return fetchHomeCore(region.lat, region.lng, region);
}
