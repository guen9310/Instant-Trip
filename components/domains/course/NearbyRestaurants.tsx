"use client";

import { useEffect, useState } from "react";
import { UtensilsCrossed, ExternalLink } from "lucide-react";
import { extractRegion } from "@/components/domains/course/extractRegion";
import { FallbackLink } from "@/components/domains/course/FallbackLink";
import { LoadingSkeleton } from "@/components/domains/course/LoadingSkeleton";

type PlaceItem = kakao.maps.services.PlacesSearchResultItem;

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
          {"'맛집 중요' 취향에 맞게 골랐어요"}
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
