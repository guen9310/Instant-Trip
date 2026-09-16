import { describe, it, expect } from "vitest";
import { summarizePetTour } from "@/lib/clients/petTour";
import { petTourInputSchema } from "@/shared/schemas/actionInputs";

describe("summarizePetTour", () => {
  it("채워진 항목이 없으면 null", () => {
    expect(summarizePetTour({ contentid: "1", acmpyTypeCd: "", acmpyPsblCpam: "  " })).toBeNull();
  });

  it("실측(매뉴얼 예시 형식) — 동반 구분·크기·필요사항을 배지로 요약한다", () => {
    const result = summarizePetTour({
      contentid: "1059479",
      acmpyTypeCd: "전구역 동반가능",
      acmpyPsblCpam: "전 견종 동반 가능",
      acmpyNeedMtr: "목줄 착용,반려동물 유모차 탑승,이동장(켄넬)사용",
    });

    expect(result).toEqual({
      zone: "all",
      sizeLabel: "전 견종",
      needLabels: ["목줄 착용", "이동장 필요", "펫 유모차 필요"],
    });
  });

  it("크기 제한은 가장 구체적인 표현(체중)을 우선한다", () => {
    const size = (acmpyPsblCpam: string) =>
      summarizePetTour({ contentid: "1", acmpyTypeCd: "전구역 동반가능", acmpyPsblCpam })
        ?.sizeLabel;

    expect(size("15kg 미만 중소형견만 입장 가능(맹견 및 대형견 입장 불가)")).toBe("15kg 미만");
    expect(size("10kg 이하 동반 가능")).toBe("10kg 이하");
    expect(size("맹견 및 대형견 제외 동반 가능")).toBe("대형견 제외");
    expect(size("이동장(켄넬)에 들어가는 전 견종 동반 가능")).toBe("이동장에 들어가는 크기");
    expect(size("맹견 제외 전 견종 동반 가능")).toBe("전 견종");
    expect(size("안내견")).toBeNull();
  });

  it("일부 구역은 partial로, 챙길 물건이 아닌 필요사항(자유이용)은 배지로 만들지 않는다", () => {
    const result = summarizePetTour({
      contentid: "1",
      acmpyTypeCd: "일부구역 동반가능",
      acmpyNeedMtr: "자유이용",
    });

    expect(result).toEqual({ zone: "partial", sizeLabel: null, needLabels: [] });
  });

  it("배지 규칙에 맞는 값이 하나도 없으면 null", () => {
    expect(summarizePetTour({ contentid: "1", acmpyPsblCpam: "안내견", acmpyNeedMtr: "기타" })).toBeNull();
  });
});

describe("petTourInputSchema", () => {
  it("TourAPI 숫자 contentid만 통과시킨다", () => {
    expect(petTourInputSchema.safeParse({ contentId: "264311" }).success).toBe(true);
    expect(petTourInputSchema.safeParse({ contentId: "kakao_1" }).success).toBe(false);
  });
});
