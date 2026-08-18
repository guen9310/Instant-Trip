import { describe, it, expect } from "vitest";
import {
  kmaToWeatherCondition,
  groupForecastByTime,
  findUpcomingWeatherChange,
  isAdverseWeather,
  isHeatwaveTemp,
  resolveWeatherGateSignal,
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

function point(
  hhmm: string,
  condition: ForecastPoint["condition"],
  tempC: number | null = null,
): ForecastPoint {
  return {
    fcstDateTime: new Date(`2026-08-09T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}:00+09:00`),
    condition,
    tempC,
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

describe("isAdverseWeather", () => {
  it("rain/snow만 true", () => {
    expect(isAdverseWeather("rain")).toBe(true);
    expect(isAdverseWeather("snow")).toBe(true);
    expect(isAdverseWeather("cloudy")).toBe(false);
    expect(isAdverseWeather("clear")).toBe(false);
  });
});

describe("isHeatwaveTemp", () => {
  it("33도 이상이면 true", () => {
    expect(isHeatwaveTemp(33)).toBe(true);
  });
  it("32.9도는 false(경계값 미만)", () => {
    expect(isHeatwaveTemp(32.9)).toBe(false);
  });
  it("null이면 false", () => {
    expect(isHeatwaveTemp(null)).toBe(false);
  });
});

describe("resolveWeatherGateSignal", () => {
  const now = new Date("2026-08-09T14:00:00+09:00");

  it("현재 clear + 창 내 rain 예보 → condition=rain 선택", () => {
    const forecast = [point("1500", "rain")];
    const signal = resolveWeatherGateSignal({ PTY: "0", SKY: "1" }, forecast, now, 3);
    expect(signal.condition).toBe("rain");
    expect(signal.hoursAhead).toBe(1);
  });

  it("condition은 snow>rain>cloudy>clear 우선순위로 창 내 최악값을 고른다", () => {
    const forecast = [point("1500", "cloudy"), point("1600", "snow"), point("1700", "rain")];
    const signal = resolveWeatherGateSignal({ PTY: "0", SKY: "1" }, forecast, now, 4);
    expect(signal.condition).toBe("snow");
  });

  it("조건은 맑아도 창 내 예보점 기온이 임계 이상이면 isHeatwave=true (조건과 독립 판정)", () => {
    const forecast = [point("1500", "clear", 34)];
    const signal = resolveWeatherGateSignal({ PTY: "0", SKY: "1", T1H: "28" }, forecast, now, 3);
    expect(signal.condition).toBe("clear");
    expect(signal.isHeatwave).toBe(true);
  });

  it("현재 실황 기온만으로도 폭염 판정된다", () => {
    const signal = resolveWeatherGateSignal({ PTY: "0", SKY: "1", T1H: "35" }, [], now, 3);
    expect(signal.isHeatwave).toBe(true);
    expect(signal.hoursAhead).toBe(0);
  });

  it("창 밖의 악화 시점은 무시한다", () => {
    const forecast = [point("1800", "rain")]; // 4시간 뒤, window=2
    const signal = resolveWeatherGateSignal({ PTY: "0", SKY: "1" }, forecast, now, 2);
    expect(signal.condition).toBe("clear");
  });

  it("빈 입력(API 실패 시뮬레이션) → clear/heatwave=false로 폴백", () => {
    const signal = resolveWeatherGateSignal({}, [], now, 3);
    expect(signal.condition).toBe("clear");
    expect(signal.isHeatwave).toBe(false);
  });
});
