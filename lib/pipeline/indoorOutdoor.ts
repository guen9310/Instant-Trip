import type { TourItem } from "@/lib/tour/types";

export type IndoorOutdoorClass = "indoor" | "outdoor" | "unknown";

// 레포츠(contenttypeid=28) 카테고리는 관광공사 코드북에 실내/실외를 구분하는
// lclsSystm 세부 코드가 없다(프로젝트 전체 조사 완료 — 문서화된 코드 없음).
// 제목 키워드로 보조 판별한다 — 이 함수에서 가장 불확실한 지점이며 오탐 가능성을
// 내포한 채로 쓴다. 정식 코드북이 생기면 이 배열을 대체해야 한다.
const INDOOR_LEISURE_KEYWORDS = [
  "실내", "클라이밍", "볼링", "스크린골프", "찜질방", "사우나", "수영장",
];

// scoring.ts의 TAG_MAPPING_RULES와 동일한 관행: contenttypeid 규칙은 TourAPI
// 출처(source!=="kakao")에만 적용한다. Kakao 후보는 contenttypeid(12/14)가 버킷
// 편의용으로만 부여됐을 뿐이라 신뢰할 수 없고, kakaoCategory로만 판별한다.
export function classifyIndoorOutdoor(item: TourItem): IndoorOutdoorClass {
  const isKakao = item.source === "kakao";

  if (!isKakao && item.contenttypeid === "14") return "indoor"; // 문화시설
  if (!isKakao && item.lclsSystm2 === "VE07") return "indoor"; // 전시시설
  if (item.kakaoCategory === "CT1") return "indoor";

  if (!isKakao && item.contenttypeid === "12") return "outdoor"; // 관광지
  if (item.kakaoCategory === "AT4") return "outdoor";

  if (!isKakao && item.contenttypeid === "28") {
    const hit = INDOOR_LEISURE_KEYWORDS.find((kw) => item.title.includes(kw));
    if (hit) {
      console.log(
        `[indoorOutdoor] 레포츠 제목 키워드 매칭 — "${item.title}" ("${hit}") → indoor`,
      );
      return "indoor";
    }
    return "outdoor"; // 등산·캠핑·골프장·스키장 등 실외가 다수 — 기본값
  }

  return "unknown";
}
