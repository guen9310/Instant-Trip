"use server";

import { getCurrentWeather, getWeatherForecastAlert } from "@/server/weather";
import { weatherForecastAlertInputSchema } from "@/shared/schemas/actionInputs";
import type { WeatherForecastAlert } from "@/shared/utils/weatherContext";

export async function fetchWeatherAction(
  lat: number,
  lng: number,
): Promise<Record<string, string>> {
  return getCurrentWeather(lat, lng);
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
