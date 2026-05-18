import { describe, it, expect, beforeEach } from "vitest";
import { usePrefsStore } from "@/client/stores/usePrefsStore";
import { DEFAULT_PREFS, type Prefs } from "@/shared/constants/preferences";

describe("usePrefsStore", () => {
  beforeEach(() => {
    usePrefsStore.setState({ prefs: DEFAULT_PREFS });
  });

  it("초기값은 DEFAULT_PREFS이다", () => {
    expect(usePrefsStore.getState().prefs).toEqual(DEFAULT_PREFS);
  });

  it("setPrefs로 전체 취향을 교체한다", () => {
    const newPrefs: Prefs = {
      travel: "min",
      party: "group",
      vibe: "lively",
      food: "any",
      indoor: "outdoor",
    };
    usePrefsStore.getState().setPrefs(newPrefs);
    expect(usePrefsStore.getState().prefs).toEqual(newPrefs);
  });

  it("setPref로 단일 키만 변경하고 나머지는 유지한다", () => {
    usePrefsStore.getState().setPref("travel", "min");
    const { prefs } = usePrefsStore.getState();

    expect(prefs.travel).toBe("min");
    // 나머지는 DEFAULT_PREFS 유지
    expect(prefs.party).toBe(DEFAULT_PREFS.party);
    expect(prefs.vibe).toBe(DEFAULT_PREFS.vibe);
    expect(prefs.food).toBe(DEFAULT_PREFS.food);
    expect(prefs.indoor).toBe(DEFAULT_PREFS.indoor);
  });

  it("setPref를 여러 번 호출해도 각각 독립적으로 반영된다", () => {
    usePrefsStore.getState().setPref("travel", "min");
    usePrefsStore.getState().setPref("vibe", "lively");

    const { prefs } = usePrefsStore.getState();
    expect(prefs.travel).toBe("min");
    expect(prefs.vibe).toBe("lively");
    expect(prefs.party).toBe(DEFAULT_PREFS.party);
  });
});
