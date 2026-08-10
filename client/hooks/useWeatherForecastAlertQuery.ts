import { useQuery } from "@tanstack/react-query";
import { fetchWeatherForecastAlertAction } from "@/app/actions/weather";

export function useWeatherForecastAlertQuery(
  lat: number | null,
  lng: number | null,
  windowHours: number,
) {
  return useQuery({
    queryKey: ["weather", "forecastAlert", lat, lng, windowHours],
    queryFn: () =>
      fetchWeatherForecastAlertAction({ lat: lat!, lng: lng!, windowHours }),
    enabled: lat != null && lng != null,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
