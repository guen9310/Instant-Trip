"use client";

import { AlertCircle, Loader2, MapPin, Zap } from "lucide-react";
import Link from "next/link";
import { useLocationStore } from "@/client/stores/useLocationStore";
import { useWeatherQuery } from "@/client/hooks/useWeatherQuery";
import {
  kmaToWeatherCondition,
  type WeatherCondition,
} from "@/shared/utils/feedContext";

const CONDITION_META: Record<
  WeatherCondition,
  { label: string; icon: string }
> = {
  clear: { label: "맑음", icon: "🌤️" },
  cloudy: { label: "흐림", icon: "☁️" },
  rain: { label: "비", icon: "🌧️" },
  snow: { label: "눈", icon: "❄️" },
};

const WEATHER_MESSAGE: Record<WeatherCondition, string> = {
  clear: "걷기 딱 좋은 날씨예요",
  cloudy: "산책하기 나쁘지 않아요",
  rain: "실내 코스를 추천해요",
  snow: "따뜻한 실내 코스 어때요",
};

export function FeedLocationCard() {
  const { state, requestPermission } = useLocationStore();

  const lat = state.status === "granted" ? (state.lat ?? null) : null;
  const lng = state.status === "granted" ? (state.lng ?? null) : null;
  const { data: weather, isPending: weatherPending } = useWeatherQuery(
    lat,
    lng,
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

    return (
      <a
        href="/start"
        className="block rounded-2xl bg-card border border-primary/20 px-5 py-4 mb-5"
      >
        <div className="flex items-center gap-1.5 mb-3">
          <MapPin size={13} className="text-text-secondary shrink-0" />
          <span className="text-[12px] text-text-secondary">{city}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
          <span className="text-[11px] text-accent font-semibold">
            위치 확인됨
          </span>
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
                <p className="text-[12px] text-text-secondary mt-1">
                  {message}
                </p>
              </>
            )}
          </div>
          <span className="shrink-0 flex items-center gap-1.5 bg-primary text-primary-foreground text-[13px] font-bold px-3.5 py-2 rounded-xl whitespace-nowrap">
            <Zap size={13} strokeWidth={2.5} />
            코스 뽑기
          </span>
        </div>
      </a>
    );
  }

  if (
    state.status === "denied" ||
    state.status === "timeout" ||
    state.status === "unavailable"
  ) {
    return (
      <Link
        href="/start"
        className="block rounded-2xl bg-card border border-point/20 px-5 py-4 mb-5"
      >
        <div className="flex items-center gap-1.5 mb-2">
          <AlertCircle size={13} className="text-point shrink-0" />
          <span className="text-[12px] text-point font-medium">
            위치 권한 거부됨
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[19px] font-extrabold text-text-primary tracking-[-0.02em] leading-tight">
              지역을 직접 선택해주세요
            </p>
            <p className="text-[12px] text-text-secondary mt-1">
              탭하면 지역 선택 화면으로 이동해요
            </p>
          </div>
          <span className="shrink-0 bg-point/10 text-point text-[13px] font-bold px-3.5 py-2 rounded-xl whitespace-nowrap">
            지역 선택
          </span>
        </div>
      </Link>
    );
  }

  const requesting = state.status === "requesting";

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
            위치를 설정해야 코스를 추천해드려요
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
