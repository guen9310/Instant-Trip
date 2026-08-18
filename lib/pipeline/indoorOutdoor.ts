import type { TourItem } from "@/lib/tour/types";

export type IndoorOutdoorClass = "indoor" | "outdoor" | "unknown";

// 레포츠(28)는 관광공사 코드북에 실내/실외 구분 코드가 없어 제목 키워드로 보조
// 판별한다 — 가장 불확실한 지점, 정식 코드북이 생기면 대체할 것.
const INDOOR_LEISURE_KEYWORDS = [
  "실내", "클라이밍", "볼링", "스크린골프", "찜질방", "사우나", "수영장",
];

// Kakao 후보는 contenttypeid가 버킷 편의용으로만 부여돼 신뢰 불가 —
// kakaoCategory로만 판별한다(scoring.ts TAG_MAPPING_RULES와 동일 관행).
export function classifyIndoorOutdoor(item: TourItem): IndoorOutdoorClass {
  const isKakao = item.source === "kakao";

  if (!isKakao && item.contenttypeid === "14") return "indoor"; // 문화시설
  if (!isKakao && item.lclsSystm2 === "VE07") return "indoor"; // 전시시설
  if (item.kakaoCategory === "CT1") return "indoor";

  if (!isKakao && item.contenttypeid === "12") return "outdoor"; // 관광지
  if (item.kakaoCategory === "AT4") return "outdoor";

  if (!isKakao && item.contenttypeid === "28") {
    // 제목의 명시적 "실외" 표기가 키워드 추측보다 우선 (예: "OO수영장(실외)").
    if (item.title.includes("실외")) return "outdoor";

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
