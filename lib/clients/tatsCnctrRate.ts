/**
 * 한국관광공사 관광지 집중률 방문자 추이 예측 정보(TatsCnctrRateService)
 * API: https://apis.data.go.kr/B551011/TatsCnctrRateService
 *
 * contentid·좌표가 아니라 관광지명(tAtsNm) 텍스트로만 식별되는 시군구 단위
 * 벌크 조회다 — 시군구(법정동 areaCd+signguCd) 하나당 호출 1번으로 그 지역
 * 관광지 전체의 향후 30일 집중률을 받는다. 개별 후보마다 조회하지 않는다.
 *
 * 이름 매칭 신뢰도는 scripts/concentration-name-match-check.ts로 실측 검증됨
 * (원주시 대상 84% 일치 — 반경 샘플이 아니라 searchKeyword2 전국 검색 기준).
 */
import { createApiFetch, extractItems, sleep } from "@/lib/tour/client";

const BASE_URL = "https://apis.data.go.kr/B551011/TatsCnctrRateService";
const fetchConcentration = createApiFetch(BASE_URL);

export interface ConcentrationItem {
  baseYmd: string;
  areaCd: string;
  areaNm?: string;
  signguCd: string;
  signguNm?: string;
  tAtsNm: string;
  cnctrRate: string;
}

// 공백·괄호 접미사(예: "(원주)") 제거 후 비교 — 스팟체크에서 검증한 정규화 방식.
export function normalizeName(s: string): string {
  return s.replace(/\s+/g, "").replace(/\([^)]*\)/g, "");
}

// areaCd+signguCd(법정동 코드) 하나당 1회(필요시 페이지네이션)로 그 지역
// 관광지 전체의 30일 집중률 로우를 가져온다. 실패해도 예외를 던지지 않고
// 빈 배열을 반환한다 — 호출부가 무감점 폴백으로 처리하게 하기 위함.
export async function fetchDistrictConcentration(
  areaCd: string,
  signguCd: string,
): Promise<ConcentrationItem[]> {
  const items: ConcentrationItem[] = [];
  let pageNo = 1;
  let totalCount = Infinity;
  try {
    while (items.length < totalCount && pageNo <= 10) {
      const res = await fetchConcentration<ConcentrationItem>(
        "tatsCnctrRatedList",
        { areaCd, signguCd, numOfRows: 500, pageNo },
      );
      const page = extractItems(res);
      items.push(...page);
      totalCount = res.response.body.totalCount;
      if (page.length === 0) break;
      pageNo++;
      if (pageNo <= 10) await sleep(100);
    }
  } catch (err) {
    console.warn(
      `[tatsCnctrRate] ${areaCd}/${signguCd} 조회 실패, 무감점 폴백 — ${err}`,
    );
    return [];
  }
  return items;
}

// 관광지명(정규화)별로 "오늘"(30일 시리즈 중 가장 이른 baseYmd) 로우 하나만 남긴다.
export function latestByName(
  items: ConcentrationItem[],
): Map<string, ConcentrationItem> {
  const map = new Map<string, ConcentrationItem>();
  for (const it of items) {
    const key = normalizeName(it.tAtsNm);
    const existing = map.get(key);
    if (!existing || it.baseYmd < existing.baseYmd) map.set(key, it);
  }
  return map;
}
