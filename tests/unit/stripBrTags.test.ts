import { describe, it, expect } from "vitest";
import { stripBrTags } from "@/lib/pipeline/availability";

describe("stripBrTags", () => {
  it("소문자 <br>을 줄바꿈으로 치환한다", () => {
    expect(stripBrTags("09:00~18:00<br>월요일 휴무")).toBe(
      "09:00~18:00\n월요일 휴무",
    );
  });

  it("대문자 <BR>을 줄바꿈으로 치환한다", () => {
    expect(stripBrTags("09:00~18:00<BR>월요일 휴무")).toBe(
      "09:00~18:00\n월요일 휴무",
    );
  });

  it("자체닫힘 <br /> 등 여러 표기가 혼재해도 줄 단위로 정리된 문자열이 된다", () => {
    expect(
      stripBrTags("평일 09:00~18:00<br/>주말 10:00~17:00<br />연중무휴"),
    ).toBe("평일 09:00~18:00\n주말 10:00~17:00\n연중무휴");
  });
});
