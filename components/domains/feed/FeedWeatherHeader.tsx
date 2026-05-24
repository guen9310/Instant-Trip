"use client";

import { useLocationStore } from "@/client/stores/useLocationStore";
import type { WeatherCondition } from "@/shared/utils/feedContext";

// TODO: 날씨 api로 변경해야 함.
const MOCK_WEATHER: {
  condition: WeatherCondition;
  temp: number;
  label: string;
  icon: string;
} = {
  condition: "clear",
  temp: 22,
  label: "맑음",
  icon: "🌤️",
};

const WEATHER_MESSAGE: Record<WeatherCondition, string> = {
  clear: "걷기 딱 좋은 날씨예요",
  cloudy: "산책하기 나쁘지 않아요",
  rain: "실내 코스를 추천해요",
  snow: "따뜻한 실내 코스 어때요",
};

export function FeedWeatherHeader() {
  const { state } = useLocationStore();
  const city = state.status === "granted" ? state.city : null;
  const { condition, temp, label, icon } = MOCK_WEATHER;
  const message = WEATHER_MESSAGE[condition];

  return (
    <div className="mb-5">
      <p className="text-[17px] font-bold text-text-primary tracking-[-0.02em] mb-0.5">
        {city ? `현재 ${city}는 ${label}(${temp}°C) ${icon}` : `오늘은 ${label}(${temp}°C) ${icon}`}
      </p>
      <p className="text-description">{message}</p>
      <p className="text-sm text-text-secondary mt-1">오늘의 코스 ↓</p>
    </div>
  );
}
