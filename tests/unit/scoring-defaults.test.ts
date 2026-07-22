import { describe, it, expect } from "vitest";
import { scoreCandidates } from "@/lib/pipeline/scoring";
import type { PlaceWithTags, UserProfile } from "@/lib/pipeline/types";

describe("scoreCandidates — 가용성 필드는 입력을 무시하고 기본값을 채운다", () => {
  it("입력에 hours/restDayNote/availabilityUncertain가 채워져 있어도 결과는 null/null/false다", async () => {
    const item: PlaceWithTags = {
      contentid: "1",
      contenttypeid: "12",
      title: "테스트 장소",
      addr1: "서울",
      addr2: "",
      mapx: "126.98",
      mapy: "37.56",
      firstimage: "",
      firstimage2: "",
      cat1: "",
      cat2: "",
      cat3: "",
      areacode: "1",
      sigungucode: "",
      createdtime: "",
      modifiedtime: "",
      tel: "",
      tagScores: { 도보친화: 0, "1인여행": 0, 실내: 0, 조용함: 0 },
      // 점수화 시점엔 아직 이 값들을 알 수 없어야 정상 — 일부러 가짜 값을 채워 넣는다
      hours: "가짜 영업시간",
      restDayNote: "가짜 휴무일",
      availabilityUncertain: true,
    };
    const profile: UserProfile = {
      tagWeights: { 도보친화: 1, "1인여행": 0, 실내: 0, 조용함: 0 },
      preferFood: false,
      location: { mapX: 126.9779, mapY: 37.5663 },
      scale: "적당히",
      areaCode: "1",
      sigunguCode: "",
    };

    const [scored] = await scoreCandidates([item], profile);

    expect(scored.hours).toBeNull();
    expect(scored.restDayNote).toBeNull();
    expect(scored.availabilityUncertain).toBe(false);
  });
});
