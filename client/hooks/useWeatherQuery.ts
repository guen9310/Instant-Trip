import { useQuery } from "@tanstack/react-query";
import { fetchWeatherAction } from "@/app/actions/weather";

export function useWeatherQuery(lat: number | null, lng: number | null) {
  return useQuery({
    queryKey: ["weather", lat, lng],
    queryFn: () => fetchWeatherAction(lat!, lng!),
    enabled: lat != null && lng != null,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
