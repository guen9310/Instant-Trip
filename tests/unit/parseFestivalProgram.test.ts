import { describe, it, expect } from "vitest";
import { parseFestivalProgram, cleanFestivalText } from "@/lib/tour/festivalDetail";

describe("cleanFestivalText", () => {
  it("빈 문자열/공백만 있으면 null", () => {
    expect(cleanFestivalText("")).toBeNull();
    expect(cleanFestivalText("   \n  \n")).toBeNull();
  });

  it("줄 단위 공백을 정리하고 빈 줄을 제거한다", () => {
    expect(cleanFestivalText("첫  줄\n\n\n둘째   줄  ")).toBe("첫 줄\n둘째 줄");
  });
});

describe("parseFestivalProgram", () => {
  it("빈 문자열이면 null", () => {
    expect(parseFestivalProgram("")).toBeNull();
  });

  it("실측(가든 나이트 마켓) 형식 — 주요 프로그램 + 부대 행사 슬래시 목록을 구조화한다", () => {
    const raw =
      "- 주요 프로그램 : 야시장(25개 마켓 부스와 16개의 푸드트럭)\n" +
      "- 부대 행사 및 프로그램 : 회전목마 / 미니기차 / 버스킹 공연 / 메카세쿼이아 숲길 체험존 / 캠핑존 / 피크닉존 / 관람객 신청곡 플레이";

    const result = parseFestivalProgram(raw);

    expect(result?.main).toBe("야시장(25개 마켓 부스와 16개의 푸드트럭)");
    expect(result?.extra).toEqual([
      "회전목마",
      "미니기차",
      "버스킹 공연",
      "메카세쿼이아 숲길 체험존",
      "캠핑존",
      "피크닉존",
      "관람객 신청곡 플레이",
    ]);
  });

  it("주요 프로그램 줄만 있고 부대 행사 줄이 없으면 extra는 빈 배열", () => {
    const result = parseFestivalProgram("- 주요 프로그램 : 프리마켓");
    expect(result?.main).toBe("프리마켓");
    expect(result?.extra).toEqual([]);
  });

  it("부대 행사 줄만 있고 주요 프로그램 줄이 없으면 main은 원문 전체로 폴백한다", () => {
    const raw = "- 부대 행사 및 프로그램 : A / B";
    const result = parseFestivalProgram(raw);
    expect(result?.main).toBe(raw);
    expect(result?.extra).toEqual(["A", "B"]);
  });

  it("인식 가능한 라벨이 전혀 없으면 전체 텍스트를 main에 담고 extra는 빈 배열", () => {
    const raw = "자유 형식의 축제 설명입니다.\n둘째 줄도 있습니다.";
    const result = parseFestivalProgram(raw);
    expect(result?.main).toBe("자유 형식의 축제 설명입니다. 둘째 줄도 있습니다.");
    expect(result?.extra).toEqual([]);
  });

  it("부대 행사 항목 사이 공백은 trim되고 빈 항목은 제거된다", () => {
    const raw = "- 부대 행사 및 프로그램 :  A  /  / B  /C";
    const result = parseFestivalProgram(raw);
    expect(result?.extra).toEqual(["A", "B", "C"]);
  });

  it("전각 콜론(：)도 라벨 구분자로 인식한다", () => {
    const raw = "- 주요 프로그램：전각 콜론 테스트";
    const result = parseFestivalProgram(raw);
    expect(result?.main).toBe("전각 콜론 테스트");
  });
});
