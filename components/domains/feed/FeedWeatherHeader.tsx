type WeatherCondition = "clear" | "cloudy" | "rainy" | "snowy";

// TODO: 날씨 api로 변경해야 함.
const MOCK_WEATHER: {
  location: string;
  condition: WeatherCondition;
  temp: number;
  label: string;
  icon: string;
} = {
  location: "마포구",
  condition: "clear",
  temp: 22,
  label: "맑음",
  icon: "🌤️",
};

const WEATHER_MESSAGE: Record<WeatherCondition, string> = {
  clear: "걷기 딱 좋은 날씨예요",
  cloudy: "산책하기 나쁘지 않아요",
  rainy: "실내 코스를 추천해요",
  snowy: "따뜻한 실내 코스 어때요",
};

export function FeedWeatherHeader() {
  const { location, condition, temp, label, icon } = MOCK_WEATHER;
  const message = WEATHER_MESSAGE[condition];

  return (
    <div className="mb-5">
      <p className="text-[17px] font-bold text-text-primary tracking-[-0.02em] mb-0.5">
        현재 {location}는 {label}({temp}°C) {icon}
      </p>
      <p className="text-description">{message}</p>
    </div>
  );
}
