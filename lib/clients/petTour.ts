/**
 * 한국관광공사 반려동물 동반여행 서비스(KorPetTourService2)
 * API: https://apis.data.go.kr/B551011/KorPetTourService2
 *
 * 무장애여행(barrierFreeTour.ts)과 같은 구조다 — 오퍼레이션·contentid 체계가 KorService2와
 * 동일해(2026-09-16 서울시청 반경 샘플 6/6 일치) 추천이 확정된 장소의 contentid 그대로
 * detailPetTour2 한 번만 호출한다. 반려동물 동반 정보가 등록된 장소는 반경 샘플 기준 전체의
 * 2~3%뿐이라 대부분의 장소는 빈 결과가 온다.
 */
import { createApiFetch, extractItems } from "@/lib/tour/client";
import { readCache, writeCache, writeCacheEmpty, CACHE_EMPTY } from "@/lib/tour/cache";
import { TTL } from "@/lib/cache/ttl";
import type { PetTourInfo, PetZone } from "@/shared/types/course.types";

const BASE_URL = "https://apis.data.go.kr/B551011/KorPetTourService2";
const fetchPetTour = createApiFetch(BASE_URL);

// detailPetTour2 응답 중 배지에 쓰는 항목만 타입으로 둔다 — 정보 없는 항목은 빈 문자열로 온다.
// 나머지(기타 동반 정보·구비 시설·품목류)는 자유 서술이라 배지로 요약할 수 없어 쓰지 않는다.
// relaAcdntRiskMtr(관련 사고 대비사항)도 실측 110건 중 51건이 acmpyPsblCpam(동반가능동물)
// 값이 복제돼 와서 쓰지 않는다.
export type DetailPetTourItem = { contentid: string } & Partial<
  Record<"acmpyTypeCd" | "acmpyPsblCpam" | "acmpyNeedMtr", string>
>;

// acmpyNeedMtr는 정해진 선택지를 쉼표로 이어 붙인 값이다(실측: "목줄 착용,이동장(켄넬)사용,
// 매너벨트 착용"). "기타"·"자유이용"은 요구사항이 아니라 배지로 만들지 않는다. 배지가 동반 범위·
// 크기 배지와 같은 줄에 놓이므로 "목줄"만으로는 뜻이 모호해 요구 동사까지 붙인다.
const NEED_RULES: readonly [RegExp, string][] = [
  [/목줄/, "목줄 착용"],
  [/이동장|켄넬/, "이동장 필요"],
  [/유모차/, "펫 유모차 필요"],
  [/매너벨트/, "매너벨트 착용"],
  [/입마개/, "입마개 착용"],
];

function zoneFor(raw: string): PetZone | null {
  if (/전\s*구역/.test(raw)) return "all";
  if (/일부\s*구역/.test(raw)) return "partial";
  return null;
}

// acmpyPsblCpam은 자유 서술이다. 실측 원문에서 반복된 제한 표현만 배지로 요약하고,
// 가장 구체적인 제한(체중)을 우선한다 — "15kg 미만 중소형견만 입장 가능"은 "15kg 미만".
// 규칙에 없는 원문("안내견")은 배지를 만들지 않는다.
function sizeLabelFor(raw: string): string | null {
  const kg = raw.match(/(\d+(?:\.\d+)?)\s*kg\s*(이하|미만)/i);
  if (kg) return `${kg[1]}kg ${kg[2]}`;
  if (/소형견만/.test(raw)) return "소형견만";
  if (/중소형견|대형견\s*(?:제외|입장\s*불가|불가)/.test(raw)) return "대형견 제외";
  if (/이동장|켄넬/.test(raw)) return "이동장에 들어가는 크기";
  if (/전\s*견종/.test(raw)) return "전 견종";
  return null;
}

// detailPetTour2 원본 1건을 배지로 요약한다. 배지가 하나도 안 나오면 null — 화면 층은
// null이면 섹션 자체를 렌더하지 않는다.
export function summarizePetTour(item: DetailPetTourItem): PetTourInfo | null {
  const typeRaw = item.acmpyTypeCd?.trim() ?? "";
  const sizeRaw = item.acmpyPsblCpam?.trim() ?? "";
  const needRaw = item.acmpyNeedMtr ?? "";

  const info: PetTourInfo = {
    zone: typeRaw ? zoneFor(typeRaw) : null,
    sizeLabel: sizeRaw ? sizeLabelFor(sizeRaw) : null,
    needLabels: NEED_RULES.flatMap(([pattern, label]) => (pattern.test(needRaw) ? [label] : [])),
  };

  const hasBadge = info.zone !== null || info.sizeLabel !== null || info.needLabels.length > 0;
  return hasBadge ? info : null;
}

// contentid 1건의 반려동물 동반 조건을 조회한다(캐시 우선). 조회 실패는 예외 없이 null —
// 추천 화면의 보조 정보일 뿐이라 실패해도 화면은 섹션만 빠진 채 정상 동작해야 한다.
// 미등록 장소가 대부분이라 빈 결과도 단기 캐시한다 — 개발계정 일 1,000건 트래픽 제한이 있다.
export async function getPetTourInfo(contentId: string): Promise<PetTourInfo | null> {
  const cacheKey = `korPet:detailPetTour2:${contentId}`;
  const cached = await readCache<DetailPetTourItem>(cacheKey);

  if (cached === CACHE_EMPTY) return null;
  if (cached !== null) return summarizePetTour(cached);

  try {
    const data = await fetchPetTour<DetailPetTourItem>("detailPetTour2", { contentId });
    const item = extractItems(data)[0];
    if (!item) {
      await writeCacheEmpty(cacheKey, TTL.EMPTY_RESULT);
      return null;
    }
    await writeCache(cacheKey, item, TTL.DETAIL_PET_TOUR);
    return summarizePetTour(item);
  } catch (err) {
    console.warn(`[petTour] detailPetTour2 조회 실패 (contentId=${contentId}) — ${err}`);
    return null;
  }
}
