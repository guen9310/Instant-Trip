"use server";

import { resolveRegion } from "@/lib/tour/regionMap";
import { fetchHomeCore } from "@/lib/home/core";

export async function getHomeDataAction(input: {
  lat: number;
  lng: number;
  city: string;
  sidoName?: string | null;
}) {
  // sidoName(시·도 레벨)을 우선 사용하고, 없으면 city(구 단위 가능)로 시도
  const region = resolveRegion(input.sidoName ?? input.city);
  if (!region) {
    console.log(
      `[home] resolveRegion 실패 — sidoName="${input.sidoName}" city="${input.city}"`,
    );
  }
  return fetchHomeCore(input.lat, input.lng, region);
}

// 위치 권한 거부 시 폴백 — 매핑 테이블의 대표 좌표로 동일한 데이터 반환
export async function getHomeDataByRegionAction(input: {
  regionName: string;
}) {
  const region = resolveRegion(input.regionName);
  if (!region) {
    console.log(`[home] resolveRegion 실패 — regionName="${input.regionName}"`);
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
