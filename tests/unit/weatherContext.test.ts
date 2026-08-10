import { describe, it, expect } from "vitest";
import {
  kmaToWeatherCondition,
  groupForecastByTime,
  findUpcomingWeatherChange,
  type ForecastPoint,
} from "@/shared/utils/weatherContext";
import type { WeatherItem } from "@/shared/types/weather.types";

function fcstItem(
  fcstDate: string,
  fcstTime: string,
  category: string,
  fcstValue: string,
): WeatherItem {
  return { baseDate: fcstDate, baseTime: fcstTime, category, nx: 60, ny: 127, fcstDate, fcstTime, fcstValue };
}

function point(hhmm: string, condition: ForecastPoint["condition"]): ForecastPoint {
  return {
    fcstDateTime: new Date(`2026-08-09T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}:00+09:00`),
    condition,
  };
}

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

describe("groupForecastByTime", () => {
  it("같은 fcstDate+fcstTime의 여러 category를 하나의 시점으로 합친다", () => {
    const items = [
      fcstItem("20260809", "1500", "PTY", "1"),
      fcstItem("20260809", "1500", "SKY", "4"),
    ];
    const result = groupForecastByTime(items);
    expect(result).toHaveLength(1);
    expect(result[0].condition).toBe("rain"); // PTY 우선
  });

  it("시간 오름차순으로 정렬한다", () => {
    const items = [
      fcstItem("20260809", "1700", "PTY", "0"),
      fcstItem("20260809", "1500", "PTY", "0"),
      fcstItem("20260809", "1600", "PTY", "0"),
    ];
    const result = groupForecastByTime(items);
    expect(result.map((p) => p.fcstDateTime.getTime())).toEqual(
      [...result.map((p) => p.fcstDateTime.getTime())].sort((a, b) => a - b),
    );
    expect(result).toHaveLength(3);
  });

  it("fcstDate/fcstTime이 없는 항목은 무시한다", () => {
    const items: WeatherItem[] = [
      { baseDate: "20260809", baseTime: "1500", category: "PTY", nx: 60, ny: 127 },
    ];
    expect(groupForecastByTime(items)).toHaveLength(0);
  });
});

describe("findUpcomingWeatherChange", () => {
  const now = new Date("2026-08-09T14:00:00+09:00");

  it("windowHours 이내에 더 나빠지는 첫 시점을 반환한다", () => {
    const forecast = [point("1500", "rain"), point("1600", "snow")];
    expect(findUpcomingWeatherChange(forecast, now, "clear", 3)).toEqual({
      condition: "rain",
      hoursAhead: 1,
    });
  });

  it("호전되는 방향(비 → 흐림)도 변화로 감지한다", () => {
    const forecast = [point("1500", "cloudy")];
    expect(findUpcomingWeatherChange(forecast, now, "rain", 3)).toEqual({
      condition: "cloudy",
      hoursAhead: 1,
    });
  });

  it("현재와 같은 컨디션만 있으면(변화 없음) null", () => {
    const forecast = [point("1500", "rain"), point("1600", "rain")];
    expect(findUpcomingWeatherChange(forecast, now, "rain", 3)).toBeNull();
  });

  it("windowHours 밖의 변화는 무시한다", () => {
    const forecast = [point("1800", "rain")]; // 4시간 뒤, window=2
    expect(findUpcomingWeatherChange(forecast, now, "clear", 2)).toBeNull();
  });

  it("이미 지난 시점(now 이전)은 무시한다", () => {
    const forecast = [point("1300", "rain")]; // now보다 과거
    expect(findUpcomingWeatherChange(forecast, now, "clear", 3)).toBeNull();
  });

  it("변화 시점이 없으면 null", () => {
    expect(findUpcomingWeatherChange([], now, "clear", 3)).toBeNull();
  });
});
