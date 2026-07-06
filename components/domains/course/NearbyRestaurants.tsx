"use client";

import { useEffect, useState } from "react";
import { UtensilsCrossed, ExternalLink } from "lucide-react";
import { cn } from "@/shared/utils";

type PlaceItem = kakao.maps.services.PlacesSearchResultItem;

function extractRegion(addr: string): string {
  const parts = addr.trim().split(/\s+/);
  if (parts.length < 2) return addr;

  const lvl1 = parts[0];

  // 특별시/광역시/특별자치시: "울산광역시 중구 ..." → "울산 중구"
  const metroMatch = lvl1.match(/^(.+?)(?:특별시|광역시|특별자치시)$/);
  if (metroMatch) {
    return `${metroMatch[1]} ${parts[1]}`;
  }

  // 도: "경기도 수원시 영통구 ..." → "수원시 영통구", "강원도 춘천시 ..." → "춘천시"
  if (lvl1.endsWith("도")) {
    if (parts.length >= 3 && /[구군]$/.test(parts[2])) {
      return `${parts[1]} ${parts[2]}`;
    }
    return parts[1];
  }

  return `${parts[0]} ${parts[1]}`;
}

type Props = {
  placeName: string;
  addr: string;
  coord: { lat: number; lng: number };
};

export function NearbyRestaurants({ placeName, addr, coord }: Props) {
  const [places, setPlaces] = useState<PlaceItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const win = window as unknown as {
      kakao?: { maps?: { load?: (cb: () => void) => void } };
    };
    win.kakao?.maps?.load?.(() => {
      if (!kakao.maps.services) {
        setFailed(true);
        return;
      }
      const region = extractRegion(addr);
      const ps = new kakao.maps.services.Places();
      ps.keywordSearch(
        `${region} 맛집`,
        (result, status) => {
          if (status === kakao.maps.services.Status.OK) {
            setPlaces(result.slice(0, 5));
          } else {
            setFailed(true);
          }
        },
        {
          location: new kakao.maps.LatLng(coord.lat, coord.lng),
          sort: kakao.maps.services.SortBy.DISTANCE,
          size: 5,
        },
      );
    });
  }, [placeName, addr, coord.lat, coord.lng]);

  if (failed || (places !== null && places.length === 0)) {
    return <FallbackLink placeName={placeName} addr={addr} />;
  }

  if (places === null) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="px-3.5 pt-3 pb-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <p className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
            <UtensilsCrossed size={13} /> 근처 맛집
          </p>
          <a
            href={`https://map.kakao.com/?q=${encodeURIComponent(extractRegion(addr) + " 맛집")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-[11px] text-accent font-medium"
          >
            지도에서 보기 <ExternalLink size={10} />
          </a>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/8 text-primary text-[11px] font-medium">
          '맛집 중요' 취향에 맞게 골랐어요
        </span>
      </div>
      <div className="flex flex-col divide-y divide-border/60">
        {places.map((p, i) => {
          const category = p.category_name.split(" > ").pop() ?? p.category_name;
          const dist = parseInt(p.distance);
          const distLabel = dist >= 1000 ? `${(dist / 1000).toFixed(1)}km` : `${dist}m`;
          return (
            <a
              key={p.id}
              href={p.place_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3.5 py-2.5 active:bg-muted transition-colors"
            >
              <span className="w-5 text-center text-[11px] font-bold text-text-secondary shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-text-primary truncate">
                  {p.place_name}
                </p>
                <p className="text-[11px] text-text-secondary">{category}</p>
              </div>
              <span className="text-[11px] text-text-secondary shrink-0">{distLabel}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function FallbackLink({ placeName, addr }: { placeName: string; addr: string }) {
  const region = extractRegion(addr);
  return (
    <a
      href={`https://map.kakao.com/?q=${encodeURIComponent(region + " 맛집")}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border"
    >
      <div className="w-9 h-9 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0">
        <UtensilsCrossed size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-secondary">근처 맛집 찾기</p>
        <p className="text-[14px] font-semibold text-text-primary truncate">
          {placeName} 주변 음식점 보기
        </p>
      </div>
      <ExternalLink size={14} className="text-text-secondary shrink-0" />
    </a>
  );
}

function LoadingSkeleton() {
  return (
    <div className="rounded-xl bg-card border border-border p-3.5 animate-pulse">
      <div className="h-3 w-16 bg-muted rounded mb-3" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-3 py-2.5",
            i < 2 && "border-b border-border/60",
          )}
        >
          <div className="w-5 h-3 bg-muted rounded shrink-0" />
          <div className="flex-1">
            <div className="h-3 w-2/3 bg-muted rounded mb-1.5" />
            <div className="h-2.5 w-1/3 bg-muted rounded" />
          </div>
          <div className="h-2.5 w-8 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}
