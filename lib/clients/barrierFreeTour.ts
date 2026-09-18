/**
 * 한국관광공사 국문 무장애여행 정보 서비스(KorWithService2)
 * API: https://apis.data.go.kr/B551011/KorWithService2
 *
 * 오퍼레이션·파라미터·contentid 체계가 기존 KorService2와 동일하다 — 같은 contentid로
 * 조회하면 같은 장소가 나오는 것을 실측 확인함(2026-09-15, 서울시청·원주시청 반경 샘플).
 * 그래서 이름 매칭 없이 추천이 확정된 장소의 contentid 그대로 detailWithTour2 한 번만
 * 호출한다. 무장애 태깅이 없는 장소(반경 샘플 기준 전체의 약 55~70%)는 빈 결과가 온다.
 */
import { createApiFetch, extractItems } from "@/lib/tour/client";
import { readCache, writeCache, writeCacheEmpty, CACHE_EMPTY } from "@/lib/tour/cache";
import { TTL } from "@/lib/cache/ttl";
import { stripBrTags } from "@/lib/pipeline/availability";
import type { BarrierFreeGroup, BarrierFreeGroupKey } from "@/shared/types/course.types";

const BASE_URL = "https://apis.data.go.kr/B551011/KorWithService2";
const fetchBarrierFree = createApiFetch(BASE_URL);

// detailWithTour2 응답 — contentid 외 모든 항목이 옵션이며, 정보 없는 항목은 빈 문자열로 온다.
export type DetailWithTourItem = { contentid: string } & Partial<
  Record<DetailWithTourField, string>
>;

type DetailWithTourField = (typeof FIELD_SPECS)[number]["field"];

// 매뉴얼(v4.3) 응답 명세의 그룹 구분을 그대로 따른다. label은 배지 문구 —
// 원문이 자유 서술이라 고정 문구로 요약할 수 없는 항목(기타 상세·매표소·홍보물)은 null이다.
// 이 중 "기타 상세"는 아래 ETC_LABEL_RULES로 원문 키워드에서 배지를 뽑는다.
const FIELD_SPECS = [
  { field: "parking",            group: "mobility", label: "장애인 주차" },
  { field: "route",              group: "mobility", label: "휠체어 접근" },
  { field: "exit",               group: "mobility", label: "휠체어 접근" },
  { field: "wheelchair",         group: "mobility", label: "휠체어 대여" },
  { field: "elevator",           group: "mobility", label: "엘리베이터" },
  { field: "restroom",           group: "mobility", label: "장애인 화장실" },
  { field: "auditorium",         group: "mobility", label: "장애인 관람석" },
  { field: "room",               group: "mobility", label: "장애인 객실" },
  { field: "publictransport",    group: "mobility", label: "대중교통 안내" },
  { field: "ticketoffice",       group: "mobility", label: null },
  { field: "promotion",          group: "mobility", label: null },
  { field: "handicapetc",        group: "mobility", label: null },
  { field: "braileblock",        group: "visual",   label: "점자블록" },
  { field: "helpdog",            group: "visual",   label: "보조견 동반" },
  { field: "guidehuman",         group: "visual",   label: "안내요원" },
  { field: "audioguide",         group: "visual",   label: "오디오 가이드" },
  { field: "bigprint",           group: "visual",   label: "점자·큰글자 안내" },
  { field: "brailepromotion",    group: "visual",   label: "점자·큰글자 안내" },
  { field: "guidesystem",        group: "visual",   label: "유도 안내 설비" },
  { field: "blindhandicapetc",   group: "visual",   label: null },
  { field: "signguide",          group: "hearing",  label: "수어 안내" },
  { field: "videoguide",         group: "hearing",  label: "자막 안내" },
  { field: "hearingroom",        group: "hearing",  label: "청각장애 객실" },
  { field: "hearinghandicapetc", group: "hearing",  label: null },
  { field: "stroller",           group: "infant",   label: "유모차 대여" },
  { field: "lactationroom",      group: "infant",   label: "수유실" },
  { field: "babysparechair",     group: "infant",   label: "유아 의자" },
  { field: "infantsfamilyetc",   group: "infant",   label: null },
] as const satisfies readonly {
  field: string;
  group: BarrierFreeGroupKey;
  label: string | null;
}[];

// "기타 상세" 원문 → 배지 문구. 실측 응답(서울·원주·부산·제주·대전·전주 반경 샘플)에서
// 반복 등장한 편의시설 표현만 규칙으로 둔다. 매칭 안 되는 원문은 배지를 만들지 않는다 —
// 기타 상세엔 "장애인 활동보조 필요_어려움"·"차가 다니는 곳으로 주의 필요"처럼
// 편의시설이 아니라 주의사항인 문장도 섞여 있어, 키워드 없이 배지를 만들면 거짓 주장이 된다.
const ETC_LABEL_RULES: Partial<Record<DetailWithTourField, readonly [RegExp, string][]>> = {
  handicapetc: [
    [/의자식|입식/, "의자식 테이블"],
    [/정보누리터|장애인\s*열람석/, "장애인 열람 공간"],
    [/전담\s*가이드/, "전담 안내 서비스"],
    [/도우미\s*벨|호출\s*벨/, "도움 호출벨"],
    [/패밀리카|전동\s*스쿠터|전동차/, "이동 차량 대여"],
    [/발달장애/, "발달장애인 자료"],
  ],
  blindhandicapetc: [
    [/점자\s*버튼/, "점자 버튼"],
    [/안내요원/, "안내요원"],
    [/점자\s*도서|촉각\s*도서|큰\s*글자\s*도서/, "점자·큰글자 도서"],
    [/오디오북|화면해설|음성\s*독서/, "음성 자료"],
    [/확대기|보이스아이|점자\s*단말기|센스리더/, "독서 보조기기"],
  ],
  hearinghandicapetc: [
    [/보청기|골전도|음성\s*증폭/, "보청기 지원"],
    [/수[화어]\s*영상|자막\s*영상/, "수어·자막 영상"],
  ],
  infantsfamilyetc: [
    [/기저귀/, "기저귀 교환대"],
    [/놀이방|키즈존|어린이실|영유아실|유아\s*휴게실/, "유아 놀이 공간"],
    [/가족\s*화장실|유아용?\s*화장실|어린이\s*화장실/, "가족 화장실"],
    [/유아용?\s*식기/, "유아 식기"],
    [/거치대|보호\s*의자|보조\s*의자|유아\s*시트/, "유아 의자"],
    [/수유실/, "수유실"],
  ],
};

const GROUP_ORDER: BarrierFreeGroupKey[] = ["mobility", "visual", "hearing", "infant"];

function labelsFor(spec: (typeof FIELD_SPECS)[number], detail: string): string[] {
  if (spec.label) return [spec.label];
  const rules = ETC_LABEL_RULES[spec.field] ?? [];
  return rules.flatMap(([pattern, label]) => (pattern.test(detail) ? [label] : []));
}

// 원문 정리 — <br> 줄바꿈 보존(stripBrTags) 후, 등록 출처 표기로 붙는 "_무장애 편의시설"·
// "_시각장애인 편의시설" 같은 접미사를 떼어낸다(실측 응답에서 확인한 형식).
function cleanDetail(raw: string): string {
  return stripBrTags(raw.replace(/_[^_\n<]*편의시설/g, ""));
}

// 값이 있어도 "없음"·"대여불가"처럼 부정 문구만 있는 항목은 편의시설로 치지 않는다 —
// 배지로 띄우면 "있다"는 거짓 주장이 된다. "공연장은 대여불가하며 미술관에 1대 구비"처럼
// 긍정 근거가 함께 있으면 살린다.
const NEGATIVE = /없음|없습니다|불가/;
const POSITIVE = /있음|있습니다|가능|구비|비치|설치|운영/;

function isNegativeOnly(detail: string): boolean {
  return NEGATIVE.test(detail) && !POSITIVE.test(detail);
}

// detailWithTour2 원본 1건을 그룹별 배지 문구로 요약한다. 같은 그룹 안에서 겹치는 문구
// (접근로·출입통로 → "휠체어 접근")는 한 번만 담고, 배지가 하나도 없는 그룹은 뺀다.
// 배지가 하나도 없으면 빈 배열 — 화면 층은 빈 배열이면 섹션 자체를 렌더하지 않는다.
export function summarizeBarrierFree(item: DetailWithTourItem): BarrierFreeGroup[] {
  const byGroup = new Map<BarrierFreeGroupKey, Set<string>>();

  for (const spec of FIELD_SPECS) {
    const raw = item[spec.field];
    if (!raw?.trim()) continue;
    const detail = cleanDetail(raw);
    if (!detail || isNegativeOnly(detail)) continue;

    const labels = byGroup.get(spec.group) ?? new Set<string>();
    for (const label of labelsFor(spec, detail)) labels.add(label);
    byGroup.set(spec.group, labels);
  }

  return GROUP_ORDER.flatMap((group) => {
    const labels = byGroup.get(group);
    return labels && labels.size > 0 ? [{ group, labels: [...labels] }] : [];
  });
}

// contentid 1건의 무장애 편의시설 요약을 조회한다(캐시 우선). 조회 실패는 예외 없이 빈 배열 —
// 이 정보는 추천 화면의 보조 배지일 뿐이라, 실패해도 화면은 배지만 빠진 채 정상 동작해야 한다.
// 빈 결과(무장애 미등록 장소)도 단기 캐시해 같은 장소를 반복 조회하지 않는다 — 개발계정
// 일 1,000건 트래픽 제한이 있다.
export async function getBarrierFreeInfo(contentId: string): Promise<BarrierFreeGroup[]> {
  const cacheKey = `korWith:detailWithTour2:${contentId}`;
  const cached = await readCache<DetailWithTourItem>(cacheKey);

  if (cached === CACHE_EMPTY) return [];
  if (cached !== null) return summarizeBarrierFree(cached);

  try {
    const data = await fetchBarrierFree<DetailWithTourItem>("detailWithTour2", { contentId });
    const item = extractItems(data)[0];
    if (!item) {
      await writeCacheEmpty(cacheKey, TTL.EMPTY_RESULT);
      return [];
    }
    await writeCache(cacheKey, item, TTL.DETAIL_WITH_TOUR);
    return summarizeBarrierFree(item);
  } catch (err) {
    console.warn(`[barrierFreeTour] detailWithTour2 조회 실패 (contentId=${contentId}) — ${err}`);
    return [];
  }
}
