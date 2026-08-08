/**
 * 공공데이터포털 전국문화축제 + Tour API searchFestival2 병합 — 순수 함수.
 * API/DB 접근 없음. 단위 테스트 가능.
 */

import { haversineKm } from "@/shared/utils/geo";
import type { CulturalFestival } from "@/lib/clients/culturalFestival";
import type { TourFestivalItem } from "@/lib/tour/searchFestival";

export const MATCH_DISTANCE_KM = 5;

/**
 * 축제명 정규화:
 *   1. 연도 접두사 제거  "2026 태화강마두희축제" → "태화강마두희축제"
 *   2. 회차 접두사 제거  "제6회 송도해변축제"    → "송도해변축제"
 *   3. 전체 공백 제거    "부산 불꽃 축제"        → "부산불꽃축제"
 * 두 소스 이름에 동일하게 적용해 매칭 키를 만든다.
 */
export function normalizeFestivalName(name: string): string {
  return name
    .replace(/^\d{4}\s*/, "")           // 연도 접두사
    .replace(/^제?\s*\d+\s*회\s*/, "")  // 회차 접두사 (제N회 / N회)
    .replace(/\s+/g, "");               // 전체 공백
}

export type MergeStats = {
  publicCount: number;
  tourCount: number;
  matchedCount: number;
  coordMissMatchCount: number;
  tourOnlyCount: number;
  publicOnlyCount: number;
  imageCount: number;
  /** 두 소스의 시작일이 다른 매칭 쌍 (날짜 우선순위 검증용) */
  dateMismatchPairs: { name: string; publicStart: string; tourStart: string }[];
  /** 이름은 같으나 좌표 거리 5km 초과로 매칭 실패한 쌍 (오매칭 방지 규칙 점검용) */
  distMismatchPairs: { name: string; distKm: number }[];
};

/** Tour API YYYYMMDD → "YYYY-MM-DD" */
function tourDateToIso(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd ?? "";
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function hasValidCoord(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
}

export function mergeFestivals(
  publicFestivals: CulturalFestival[],
  tourFestivals: TourFestivalItem[],
): { festivals: CulturalFestival[]; stats: MergeStats } {
  // normalized name → TourFestivalItem[] 역색인
  const tourByName = new Map<string, TourFestivalItem[]>();
  for (const tf of tourFestivals) {
    const key = normalizeFestivalName(tf.title);
    const arr = tourByName.get(key);
    if (arr) arr.push(tf);
    else tourByName.set(key, [tf]);
  }

  const matchedTourIds = new Set<string>();
  const result: CulturalFestival[] = [];
  let coordMissMatchCount = 0;
  const dateMismatchPairs: MergeStats["dateMismatchPairs"] = [];
  const distMismatchPairs: MergeStats["distMismatchPairs"] = [];

  for (const pub of publicFestivals) {
    const normPub = normalizeFestivalName(pub.fstvlNm);
    const candidates = tourByName.get(normPub) ?? [];

    // 1단계: 좌표 거리 5km 이내 중 가장 가까운 후보 선택
    let matched: TourFestivalItem | null = null;
    let matchedDist = Infinity;
    let noCoordFallback: TourFestivalItem | null = null;
    let bestFailDist: number | null = null;

    for (const cand of candidates) {
      const tourLat = parseFloat(cand.mapy);
      const tourLng = parseFloat(cand.mapx);

      if (hasValidCoord(pub.latitude, pub.longitude) && hasValidCoord(tourLat, tourLng)) {
        const dist = haversineKm(pub.latitude, pub.longitude, tourLat, tourLng);
        if (dist <= MATCH_DISTANCE_KM && dist < matchedDist) {
          matched = cand;
          matchedDist = dist;
        } else if (matched === null) {
          if (bestFailDist === null || dist < bestFailDist) bestFailDist = dist;
        }
      } else if (noCoordFallback === null) {
        // 좌표가 한쪽이라도 없으면 이름 일치만으로 매칭 (플래그 설정)
        noCoordFallback = cand;
      }
    }

    // 2단계: 좌표 매칭 실패 시 이름만 매칭 (coordMissMatch 플래그)
    let isCordMiss = false;
    if (matched === null && noCoordFallback !== null) {
      matched = noCoordFallback;
      isCordMiss = true;
    }

    // 좌표는 있는데 거리 초과로 매칭 실패 → 오매칭 방지 규칙 점검용 기록
    if (matched === null && bestFailDist !== null) {
      distMismatchPairs.push({
        name: pub.fstvlNm,
        distKm: Math.round(bestFailDist * 10) / 10,
      });
    }

    if (matched) {
      matchedTourIds.add(matched.contentid);
      if (isCordMiss) coordMissMatchCount++;

      const tourStart = tourDateToIso(matched.eventstartdate);
      const tourEnd = tourDateToIso(matched.eventenddate);

      if (tourStart && tourStart !== pub.fstvlStartDate) {
        dateMismatchPairs.push({
          name: pub.fstvlNm,
          publicStart: pub.fstvlStartDate,
          tourStart,
        });
      }

      const tourLat = parseFloat(matched.mapy);
      const tourLng = parseFloat(matched.mapx);

      const merged: CulturalFestival = {
        // 설명·주최·전화·홈페이지: 공공데이터포털
        ...pub,
        // 날짜·이미지: searchFestival2 우선
        fstvlStartDate: tourStart || pub.fstvlStartDate,
        fstvlEndDate: tourEnd || pub.fstvlEndDate,
        imageUrl: matched.firstimage || matched.firstimage2 || undefined,
        // 좌표: 공공데이터포털 우선 (지번 기반이라 정밀), 없으면 searchFestival2
        latitude: hasValidCoord(pub.latitude, pub.longitude) ? pub.latitude : tourLat,
        longitude: hasValidCoord(pub.latitude, pub.longitude) ? pub.longitude : tourLng,
        sources: ["public", "tour"],
        coordMissMatch: isCordMiss || undefined,
        // Tour API와 매칭됐으므로 detailIntro2로 프로그램 상세를 보강할 수 있다.
        contentid: matched.contentid,
      };
      result.push(merged);
    } else {
      result.push({ ...pub, sources: ["public"] });
    }
  }

  // Tour API 단독 축제 (공공데이터포털에 없는 축제) 추가
  for (const tf of tourFestivals) {
    if (matchedTourIds.has(tf.contentid)) continue;
    const tourLat = parseFloat(tf.mapy);
    const tourLng = parseFloat(tf.mapx);
    result.push({
      fstvlNm: tf.title,
      opar: "",
      fstvlStartDate: tourDateToIso(tf.eventstartdate),
      fstvlEndDate: tourDateToIso(tf.eventenddate),
      fstvlCo: "",
      mnnstNm: "",
      auspcInsttNm: "",
      suprtInsttNm: "",
      phoneNumber: tf.tel || "",
      homepageUrl: "",
      relateInfo: "",
      rdnmadr: tf.addr1 || "",
      lnmadr: tf.addr1 || "",
      latitude: isNaN(tourLat) ? 0 : tourLat,
      longitude: isNaN(tourLng) ? 0 : tourLng,
      referenceDate: "",
      insttCode: "",
      insttNm: "",
      imageUrl: tf.firstimage || tf.firstimage2 || undefined,
      sources: ["tour"],
      contentid: tf.contentid,
    });
  }

  const imageCount = result.filter((f) => !!f.imageUrl).length;

  return {
    festivals: result,
    stats: {
      publicCount: publicFestivals.length,
      tourCount: tourFestivals.length,
      matchedCount: matchedTourIds.size,
      coordMissMatchCount,
      tourOnlyCount: tourFestivals.length - matchedTourIds.size,
      publicOnlyCount: publicFestivals.length - matchedTourIds.size,
      imageCount,
      dateMismatchPairs,
      distMismatchPairs,
    },
  };
}
