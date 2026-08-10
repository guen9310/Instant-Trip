"use client";

import { AlertCircle, CloudRain, Loader2, MapPin, Zap } from "lucide-react";
import { useLocationStore } from "@/client/stores/useLocationStore";
import { useWeatherQuery } from "@/client/hooks/useWeatherQuery";
import { useWeatherForecastAlertQuery } from "@/client/hooks/useWeatherForecastAlertQuery";
import { AttributionNotice } from "@/components/commons/AttributionNotice";
import {
  kmaToWeatherCondition,
  type WeatherCondition,
} from "@/shared/utils/weatherContext";

const CONDITION_META: Record<WeatherCondition, { label: string; icon: string }> = {
  clear: { label: "맑음", icon: "🌤️" },
  cloudy: { label: "흐림", icon: "☁️" },
  rain: { label: "비", icon: "🌧️" },
  snow: { label: "눈", icon: "❄️" },
};

const WEATHER_MESSAGE: Record<WeatherCondition, string> = {
  clear: "걷기 딱 좋은 날씨예요",
  cloudy: "산책하기 나쁘지 않아요",
  rain: "실내 장소를 추천해요",
  snow: "따뜻한 실내는 어때요",
};

// 출발 전 판단에 도움이 될 만큼의 여유(2시간)를 두고 예보 변화를 확인한다.
const FORECAST_WINDOW_HOURS = 2;

const FORECAST_CHANGE_LABEL: Record<WeatherCondition, string> = {
  clear: "맑아질",
  cloudy: "흐려질",
  rain: "비가 올",
  snow: "눈이 올",
};

interface Props {
  // 수동 지역 선택 시 스토어에 좌표가 없으므로 홈 데이터의 region 대표 좌표를 외부에서 주입
  regionLat?: number;
  regionLng?: number;
}

export function HomeLocationCard({ regionLat, regionLng }: Props) {
  const { state, requestPermission } = useLocationStore();

  const storeLat = state.status === "granted" ? (state.lat ?? null) : null;
  const storeLng = state.status === "granted" ? (state.lng ?? null) : null;
  const weatherLat = storeLat ?? regionLat ?? null;
  const weatherLng = storeLng ?? regionLng ?? null;

  const { data: weather, isPending: weatherPending } = useWeatherQuery(
    weatherLat,
    weatherLng,
  );
  const { data: forecastAlert } = useWeatherForecastAlertQuery(
    weatherLat,
    weatherLng,
    FORECAST_WINDOW_HOURS,
  );

  if (state.status === "granted") {
    const { city } = state;
    const condition: WeatherCondition = weather
      ? kmaToWeatherCondition(weather)
      : "clear";
    const temp = weather?.T1H != null ? Math.round(Number(weather.T1H)) : null;
    const { label, icon } = CONDITION_META[condition];
    const message = WEATHER_MESSAGE[condition];
    const tempStr = temp != null ? `${temp}°C` : "";
    const forecastMessage = forecastAlert
      ? `${forecastAlert.hoursAhead}시간 뒤 ${FORECAST_CHANGE_LABEL[forecastAlert.condition]} 예정이에요`
      : null;

    return (
      <div className="relative mb-5">
        <a
          href="/start"
          className="block rounded-2xl bg-card border border-primary/20 px-5 py-4"
        >
          <div className="flex items-center gap-1.5 mb-3">
            <MapPin size={13} className="text-text-secondary shrink-0" />
            <span className="text-[12px] text-text-secondary">{city}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            <span className="text-[11px] text-accent font-semibold">위치 확인됨</span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              {weatherPending ? (
                <>
                  <div className="h-5.75 w-36 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-28 rounded bg-muted animate-pulse mt-1" />
                </>
              ) : (
                <>
                  <p className="text-[19px] font-extrabold text-text-primary tracking-[-0.02em] leading-tight">
                    {label}
                    {tempStr ? ` ${tempStr}` : ""} {icon}
                  </p>
                  <p className="text-[12px] text-text-secondary mt-1">{message}</p>
                  {forecastMessage && (
                    <p className="flex items-center gap-1 text-[11px] text-text-secondary mt-1">
                      <CloudRain size={13} strokeWidth={2} className="shrink-0" />
                      {forecastMessage}
                    </p>
                  )}
                </>
              )}
            </div>
            <span className="shrink-0 flex items-center gap-1.5 bg-primary text-primary-foreground text-[13px] font-bold px-3.5 py-2 rounded-xl whitespace-nowrap">
              <Zap size={13} strokeWidth={2.5} />
              출발하기
            </span>
          </div>
        </a>
        {/* 카드 전체가 링크라 출처 아이콘은 별도 형제 요소로 얹는다(중첩 인터랙티브 요소 방지) */}
        <div className="absolute top-4 right-5">
          <AttributionNotice>
            기상청 제공
          </AttributionNotice>
        </div>
      </div>
    );
  }

  const requesting =
    state.status === "requesting" || state.status === "idle";

  return (
    <button
      onClick={requestPermission}
      disabled={requesting}
      className="block w-full text-left rounded-2xl bg-card border border-point/20 px-5 py-4 mb-5 disabled:opacity-60"
    >
      <div className="flex items-center gap-1.5 mb-2">
        {requesting ? (
          <Loader2 size={13} className="text-point shrink-0 animate-spin" />
        ) : (
          <AlertCircle size={13} className="text-point shrink-0" />
        )}
        <span className="text-[12px] text-point font-medium">
          {requesting ? "위치 확인 중..." : "위치 미설정"}
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[19px] font-extrabold text-text-primary tracking-[-0.02em] leading-tight">
            위치를 설정하면 갈 곳을 추천해드려요
          </p>
          <p className="text-[12px] text-text-secondary mt-1">
            탭하면 현재 위치를 확인해드려요
          </p>
        </div>
        <span className="shrink-0 flex items-center gap-1.5 bg-point/10 text-point text-[13px] font-bold px-3.5 py-2 rounded-xl whitespace-nowrap">
          {requesting ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            "위치 설정"
          )}
        </span>
      </div>
    </button>
  );
}
