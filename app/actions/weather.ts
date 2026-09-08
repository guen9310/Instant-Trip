"use server";

import { getCurrentWeather, getWeatherForecastAlert } from "@/server/weather";
import {
  currentWeatherInputSchema,
  weatherForecastAlertInputSchema,
} from "@/shared/schemas/actionInputs";
import type { WeatherForecastAlert } from "@/shared/utils/weatherContext";

export async function fetchWeatherAction(
  lat: number,
  lng: number,
): Promise<Record<string, string>> {
  // 다른 API 실패(weatherFetch 등)와 동일하게 조용히 빈 객체로 폴백한다 —
  // 이 값을 쓰는 화면은 이미 항목이 없는 경우를 "데이터 없음"으로 다루고 있다.
  const parsed = currentWeatherInputSchema.safeParse({ lat, lng });
  if (!parsed.success) return {};
  return getCurrentWeather(parsed.data.lat, parsed.data.lng);
}

export async function fetchWeatherForecastAlertAction(
  input: unknown,
): Promise<WeatherForecastAlert | null> {
  const parsed = weatherForecastAlertInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid weather forecast alert request");
  }
  const { lat, lng, windowHours } = parsed.data;
  return getWeatherForecastAlert(lat, lng, windowHours);
}
