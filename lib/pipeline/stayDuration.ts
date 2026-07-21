import type { DurationRange } from "@/shared/utils/duration";

// 예상 체류시간 추정 입력 — 분류 코드 기반.
export type StayDurationInput = {
  lclsSystm1?: string;
  lclsSystm2?: string;
  lclsSystm3?: string;
  source?: "tour" | "kakao";
  kakaoCategory?: string;
};

type StayDurationRule = {
  // 규칙 식별용 라벨(로그·디버깅 용도)
  key: string;
  label: string;
  match: (i: StayDurationInput) => boolean;
  range: DurationRange;
};

// 기본 범위 — 분류 코드가 어느 규칙에도 매칭되지 않는 장소(역사유적·랜드마크 등)
export const STAY_DURATION_DEFAULT: DurationRange = { min: 60, max: 120 };

// 카테고리별 예상 체류시간 범위(분). TourAPI에 실데이터가 없어 카테고리 상수로 추정한다.
// 순서가 우선순위다: kakao 출처 먼저, 그다음 구체적인 코드(긴 prefix) 먼저.
export const STAY_DURATION_TABLE: StayDurationRule[] = [
  {
    key: "kakao:AT4",
    label: "카카오 관광명소",
    match: (i) => i.source === "kakao" && i.kakaoCategory === "AT4",
    range: { min: 30, max: 60 },
  },
  {
    key: "kakao:CT1",
    label: "카카오 문화시설",
    match: (i) => i.source === "kakao" && i.kakaoCategory === "CT1",
    range: { min: 90, max: 150 },
  },
  {
    key: "lcls3:VE010200",
    label: "타워/전망대",
    match: (i) => i.lclsSystm3 === "VE010200",
    range: { min: 30, max: 60 },
  },
  {
    key: "lcls3:VE0403|VE0401",
    label: "둘레길, 골목길/문화거리",
    match: (i) => i.lclsSystm3 === "VE040300" || i.lclsSystm3 === "VE040100",
    range: { min: 30, max: 60 },
  },
  {
    key: "lcls2:VE03",
    label: "도시공원",
    match: (i) => i.lclsSystm2 === "VE03",
    range: { min: 30, max: 60 },
  },
  {
    // 캠핑 — 당일 방문 야외 공간. 도시공원보다 머무는 시간이 길다(휴식·물놀이 등 활동 포함)
    key: "lcls2:AC05",
    label: "캠핑",
    match: (i) => i.lclsSystm2 === "AC05",
    range: { min: 60, max: 120 },
  },
  {
    key: "lcls1:NA",
    label: "자연관광(해수욕장·산·강 등)",
    match: (i) => i.lclsSystm1 === "NA",
    range: { min: 40, max: 90 },
  },
  {
    key: "lcls2:VE07",
    label: "전시시설(박물관/미술관 등)",
    match: (i) => i.lclsSystm2 === "VE07",
    range: { min: 90, max: 150 },
  },
  {
    key: "lcls1:EX",
    label: "체험관광",
    match: (i) => i.lclsSystm1 === "EX",
    range: { min: 90, max: 150 },
  },
  {
    // 테마공원 — 박물관형 체류가 아니라 반나절 단위 위락시설 체류가 일반적
    key: "lcls2:VE02",
    label: "테마공원",
    match: (i) => i.lclsSystm2 === "VE02",
    range: { min: 150, max: 240 },
  },
];

// 미매칭 장소의 규칙 식별자
export const STAY_DURATION_DEFAULT_KEY = "default";

// 매칭된 규칙의 key와 범위를 함께 반환한다.
export function matchStayDurationRule(input: StayDurationInput): {
  key: string;
  range: DurationRange;
} {
  for (const rule of STAY_DURATION_TABLE) {
    if (rule.match(input)) return { key: rule.key, range: rule.range };
  }
  return { key: STAY_DURATION_DEFAULT_KEY, range: STAY_DURATION_DEFAULT };
}

// 예상 체류시간 추정 단일 진입점.
// 실측 통계 도입 시 시그니처를 유지한 채 내부 lookup만 교체한다.
export function estimateStayDuration(input: StayDurationInput): DurationRange {
  return matchStayDurationRule(input).range;
}
