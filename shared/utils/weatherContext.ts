export type WeatherCondition = "clear" | "cloudy" | "rain" | "snow";

// PTY(강수형태) 우선, SKY(하늘상태)는 초단기예보에서만 제공됨
export function kmaToWeatherCondition(
  weather: Record<string, string>,
): WeatherCondition {
  const pty = weather.PTY ?? "0";
  if (pty === "3" || pty === "7") return "snow";
  if (pty !== "0") return "rain";
  const sky = weather.SKY;
  if (sky === "3" || sky === "4") return "cloudy";
  return "clear";
}
