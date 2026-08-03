"use server";

import { resolveRegion } from "@/lib/tour/regionMap";
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

  // sidoName(시·도 레벨)을 우선 사용하고, 없으면 city(구 단위 가능)로 시도
  const region = resolveRegion(sidoName ?? city);
  if (!region) {
    console.log(
      `[home] resolveRegion 실패 — sidoName="${sidoName}" city="${city}"`,
    );
  }
  return fetchHomeCore(lat, lng, region);
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
