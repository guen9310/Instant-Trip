import { describe, it, expect, beforeEach } from "vitest";
import { useDarkModeStore } from "@/client/stores/useDarkModeStore";

describe("useDarkModeStore", () => {
  beforeEach(() => {
    useDarkModeStore.setState({ theme: "system" });
  });

  it("초기값은 system이다", () => {
    expect(useDarkModeStore.getState().theme).toBe("system");
  });

  it("cycleTheme으로 light → dark → system → light 순환한다", () => {
    // system → light
    useDarkModeStore.setState({ theme: "light" });
    useDarkModeStore.getState().cycleTheme();
    expect(useDarkModeStore.getState().theme).toBe("dark");

    // dark → system
    useDarkModeStore.getState().cycleTheme();
    expect(useDarkModeStore.getState().theme).toBe("system");

    // system → light
    useDarkModeStore.getState().cycleTheme();
    expect(useDarkModeStore.getState().theme).toBe("light");
  });

  it("setTheme으로 직접 테마를 설정한다", () => {
    useDarkModeStore.getState().setTheme("dark");
    expect(useDarkModeStore.getState().theme).toBe("dark");

    useDarkModeStore.getState().setTheme("light");
    expect(useDarkModeStore.getState().theme).toBe("light");
  });
});
