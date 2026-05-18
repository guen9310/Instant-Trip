import { describe, it, expect } from "vitest";
import { buildProfileSummary, buildReexplorationText } from "@/shared/utils/prefsText";
import type { Prefs } from "@/shared/constants/preferences";

/* ──────────────────────────────────────────────
 *  buildProfileSummary
 * ────────────────────────────────────────────── */
describe("buildProfileSummary", () => {
  it("조용한 + 혼자 + 도보 + 맛집 + 실내 조합", () => {
    const prefs: Prefs = {
      travel: "walk",
      party: "solo",
      vibe: "quiet",
      food: "matjip",
      indoor: "indoor",
    };
    const result = buildProfileSummary(prefs);

    expect(result.vibe).toContain("조용한");
    expect(result.preference).toContain("혼자");
    expect(result.preference).toContain("천천히 걸으며");
    expect(result.recommend).toContain("실내 위주의");
    expect(result.recommend).toContain("맛집이 포함된");
    expect(result.recommend).toContain("도보 코스");
  });

  it("활기찬 + 같이 + 이동최소 + 아무거나 + 야외 조합", () => {
    const prefs: Prefs = {
      travel: "min",
      party: "group",
      vibe: "lively",
      food: "any",
      indoor: "outdoor",
    };
    const result = buildProfileSummary(prefs);

    expect(result.vibe).toContain("활기찬");
    expect(result.preference).toContain("함께");
    expect(result.preference).toContain("이동을 최소화해서");
    expect(result.recommend).toContain("야외 위주의");
    expect(result.recommend).not.toContain("맛집");
    // travel이 "min"이면 "코스"만 표시 (도보 코스 아님)
    expect(result.recommend).toMatch(/코스를 추천/);
  });

  it("food가 any이면 맛집 텍스트가 포함되지 않는다", () => {
    const prefs: Prefs = {
      travel: "walk",
      party: "solo",
      vibe: "quiet",
      food: "any",
      indoor: "indoor",
    };
    const result = buildProfileSummary(prefs);
    expect(result.recommend).not.toContain("맛집");
  });
});

/* ──────────────────────────────────────────────
 *  buildReexplorationText
 * ────────────────────────────────────────────── */
describe("buildReexplorationText", () => {
  it("조용한 + 도보 + 실내 + 맛집 조합", () => {
    const prefs: Prefs = {
      travel: "walk",
      party: "solo",
      vibe: "quiet",
      food: "matjip",
      indoor: "indoor",
    };
    const result = buildReexplorationText(prefs);

    expect(result.line1).toContain("조용한");
    expect(result.line1).toContain("도보 코스");
    expect(result.line2).toContain("실내 위주의");
    expect(result.line2).toContain("맛집이 포함된");
  });

  it("활기찬 + 이동최소 + 야외 + 아무거나 조합", () => {
    const prefs: Prefs = {
      travel: "min",
      party: "group",
      vibe: "lively",
      food: "any",
      indoor: "outdoor",
    };
    const result = buildReexplorationText(prefs);

    expect(result.line1).toContain("활기찬");
    expect(result.line1).not.toContain("도보");
    expect(result.line2).toContain("야외 위주의");
    expect(result.line2).not.toContain("맛집");
    expect(result.line2).toContain("새로운 코스를 추천");
  });
});
