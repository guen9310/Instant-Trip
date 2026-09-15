import { describe, it, expect } from "vitest";
import { summarizeBarrierFree } from "@/lib/clients/barrierFreeTour";
import { barrierFreeInputSchema, tourContentIdSchema } from "@/shared/schemas/actionInputs";

describe("summarizeBarrierFree", () => {
  it("채워진 항목이 없으면 빈 배열", () => {
    expect(summarizeBarrierFree({ contentid: "1", parking: "", route: "  " })).toEqual([]);
  });

  it("실측(서울도서관 형식) — 그룹 순서대로 묶고 등록 출처 접미사·<br>을 정리한다", () => {
    const result = summarizeBarrierFree({
      contentid: "130183",
      lactationroom: "수유실 있음(지하 2층)",
      parking: "장애인 주차장 있음_무장애 편의시설",
      braileblock: "점자블록 있음(주출입구)_시각장애인 편의시설",
      publictransport: "대중교통 이용 가능 : 시청앞 정류장<br/>저상버스 운행 : 모든 버스",
    });

    expect(result.map((g) => g.group)).toEqual(["mobility", "visual", "infant"]);
    expect(result[0].facilities).toEqual([
      { labels: ["장애인 주차"], name: "주차", detail: "장애인 주차장 있음" },
      {
        labels: ["대중교통 안내"],
        name: "대중교통",
        detail: "대중교통 이용 가능 : 시청앞 정류장\n저상버스 운행 : 모든 버스",
      },
    ]);
    expect(result[1].facilities[0].detail).toBe("점자블록 있음(주출입구)");
  });

  it("부정 문구만 있는 항목은 제외하고, 긍정 근거가 함께 있으면 살린다", () => {
    const result = summarizeBarrierFree({
      contentid: "1",
      elevator: "엘리베이터 없음",
      wheelchair: "공연장은 대여불가하며 미술관에 1대 구비",
      stroller: "대여불가",
    });

    expect(result).toHaveLength(1);
    expect(result[0].facilities.map((f) => f.name)).toEqual(["휠체어"]);
  });

  it("기타 상세는 원문 키워드로 배지를 뽑는다 — 한 원문에 여러 시설이 있으면 여러 개", () => {
    const result = summarizeBarrierFree({
      contentid: "1",
      handicapetc: "의자식 테이블 있음_무장애 편의시설",
      // 실측(서울도서관) — 줄바꿈 없이 붙어 오는 원문도 그대로 매칭돼야 한다.
      blindhandicapetc:
        "시각장애인을 위한 컨텐츠 있음_시각장애인 편의시설<br/>점자도서,큰글자도서,오디오북<br/>독서확대기,보이스아이",
      infantsfamilyetc: "가족화장실 있음기저귀교환대 있음유아놀이방 있음",
    });

    expect(result[0].facilities[0]).toEqual({
      labels: ["의자식 테이블"],
      name: "기타",
      detail: "의자식 테이블 있음",
    });
    expect(result[1].facilities[0].labels).toEqual([
      "점자·큰글자 도서",
      "음성 자료",
      "독서 보조기기",
    ]);
    expect(result[2].facilities[0].labels).toEqual([
      "기저귀 교환대",
      "유아 놀이 공간",
      "가족 화장실",
    ]);
  });

  it("키워드가 없는 기타 상세(주의사항 등)는 배지 없이 상세에만 남긴다", () => {
    const result = summarizeBarrierFree({
      contentid: "1",
      handicapetc: "실제 차가 다니는 곳으로 주의 필요",
    });

    expect(result[0].facilities[0]).toEqual({
      labels: [],
      name: "기타",
      detail: "실제 차가 다니는 곳으로 주의 필요",
    });
  });
});

describe("tourContentIdSchema", () => {
  it("TourAPI 숫자 contentid만 통과시킨다", () => {
    expect(tourContentIdSchema.safeParse("130183").success).toBe(true);
    expect(tourContentIdSchema.safeParse("kakao_12345").success).toBe(false);
    expect(tourContentIdSchema.safeParse("2026-09-01_축제").success).toBe(false);
    expect(barrierFreeInputSchema.safeParse({ contentId: "" }).success).toBe(false);
  });
});
