"use client";

import { AlertCircle, Loader2, MapPin, Zap } from "lucide-react";
import { useLocationStore } from "@/client/stores/useLocationStore";
import Link from "next/link";

export function FeedStartCard() {
  const { state, requestPermission } = useLocationStore();

  const city = state.status === "granted" ? state.city : null;
  const requesting = state.status === "requesting";
  const isDenied =
    state.status === "denied" ||
    state.status === "timeout" ||
    state.status === "unavailable";

  if (city) {
    return (
      <a
        href="/start"
        className="block rounded-2xl bg-card border border-primary/20 px-5 py-4 mb-5"
      >
        <div className="flex items-center gap-1.5 mb-2">
          <MapPin size={13} className="text-text-secondary shrink-0" />
          <span className="text-[12px] text-text-secondary">{city}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
          <span className="text-[11px] text-accent font-semibold">위치 확인됨</span>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[19px] font-extrabold text-text-primary tracking-[-0.02em] leading-tight">
              지금 바로 떠날 수 있어요
            </p>
            <p className="text-[12px] text-text-secondary mt-1">
              취향에 맞는 코스를 즉석에서 만들어드려요
            </p>
          </div>
          <span className="shrink-0 flex items-center gap-1.5 bg-primary text-primary-foreground text-[13px] font-bold px-3.5 py-2 rounded-xl whitespace-nowrap">
            <Zap size={13} strokeWidth={2.5} />
            코스 뽑기
          </span>
        </div>
      </a>
    );
  }

  // 권한 거부/불가 상태 — /start에서 인라인으로 지역 선택 가능
  if (isDenied) {
    return (
      <Link
        href="/start"
        className="block rounded-2xl bg-card border border-point/20 px-5 py-4 mb-5"
      >
        <div className="flex items-center gap-1.5 mb-2">
          <AlertCircle size={13} className="text-point shrink-0" />
          <span className="text-[12px] text-point font-medium">위치 권한 거부됨</span>
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

  // idle / requesting — 위치 요청 카드
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
          {requesting ? <Loader2 size={13} className="animate-spin" /> : "위치 설정"}
        </span>
      </div>
    </button>
  );
}
