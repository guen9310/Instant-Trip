"use server";

import { getCurrentWeather } from "@/server/weather";

export async function fetchWeatherAction(
  lat: number,
  lng: number,
): Promise<Record<string, string>> {
  return getCurrentWeather(lat, lng);
}
