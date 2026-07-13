import { describe, it, expect } from "vitest";
import { kmaToWeatherCondition } from "@/shared/utils/feedContext";

describe("kmaToWeatherCondition", () => {
  it("PTY=3(적설) → snow", () => {
    expect(kmaToWeatherCondition({ PTY: "3" })).toBe("snow");
  });

  it("PTY=7(눈비) → snow", () => {
    expect(kmaToWeatherCondition({ PTY: "7" })).toBe("snow");
  });

  it("PTY=1(비) → rain", () => {
    expect(kmaToWeatherCondition({ PTY: "1" })).toBe("rain");
  });

  it("PTY=2(비/눈) → rain", () => {
    expect(kmaToWeatherCondition({ PTY: "2" })).toBe("rain");
  });

  it("PTY=0, SKY=3(구름많음) → cloudy", () => {
    expect(kmaToWeatherCondition({ PTY: "0", SKY: "3" })).toBe("cloudy");
  });

  it("PTY=0, SKY=4(흐림) → cloudy", () => {
    expect(kmaToWeatherCondition({ PTY: "0", SKY: "4" })).toBe("cloudy");
  });

  it("PTY=0, SKY=1(맑음) → clear", () => {
    expect(kmaToWeatherCondition({ PTY: "0", SKY: "1" })).toBe("clear");
  });

  it("PTY 없으면 0으로 간주하여 SKY 분기", () => {
    expect(kmaToWeatherCondition({ SKY: "4" })).toBe("cloudy");
  });

  it("PTY=0, SKY 없으면 → clear", () => {
    expect(kmaToWeatherCondition({ PTY: "0" })).toBe("clear");
  });
});
