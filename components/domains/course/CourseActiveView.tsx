"use client";

import { useState } from "react";
import { ExternalLink, Check, MapPin, Clock, AlertTriangle, ChevronDown, CloudRain } from "lucide-react";
import { PlaceThumbnail } from "@/components/domains/course/PlaceThumbnail";
import { NearbyPanel } from "@/components/domains/course/NearbyPanel";
import { cn, isBlank } from "@/shared/utils";
import { Badge } from "@/components/commons/Badge";
import { Button } from "@/components/commons/Button";
import { useCourseActive } from "@/client/hooks/useCourseActive";
import { useWeatherForecastAlertQuery } from "@/client/hooks/useWeatherForecastAlertQuery";
import type { ResumableCourse } from "@/shared/types/course.types";

type Props = {
  courseId: string;
  // localStorage에 세션이 없을 때(다른 기기·저장소 초기화 등) 쓰는 서버 측 대비책.
  // page.tsx가 미리 조회해둔다 — 자세한 이유는 useCourseActive.ts 참고.
  dbFallback: ResumableCourse | null;
};

// 진행 중인 외출은 "곧" 비가 오는지가 중요하므로 홈보다 짧은 창을 본다.
const FORECAST_WINDOW_HOURS = 1;

export function CourseActiveView({ courseId, dbFallback }: Props) {
  const state = useCourseActive(courseId, dbFallback);
  const [descOpen, setDescOpen] = useState(false);
  const [nearbyExpanded, setNearbyExpanded] = useState(true);

  const weatherCoord = state.status === "ready" ? state.placeCoord : null;
  const { data: forecastAlert } = useWeatherForecastAlertQuery(
    weatherCoord?.lat ?? null,
    weatherCoord?.lng ?? null,
    FORECAST_WINDOW_HOURS,
  );

  if (state.status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { place, placeCoord, cat, setCat, filteredPois, poisLoading, selectedPoiId, selectPoi, handleComplete } = state;
  // 우산 안내는 비/눈으로 바뀔 때만 의미가 있다(흐려지거나 갤 땐 카드를 띄우지 않는다).
  const rainAlert =
    forecastAlert && (forecastAlert.condition === "rain" || forecastAlert.condition === "snow")
      ? forecastAlert
      : null;

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {/* 장소 이미지 */}
        <div className="relative h-52 bg-card overflow-hidden shrink-0">
          <PlaceThumbnail
            imageUrl={place.imageUrl}
            cat={place.cat}
            className="w-full h-full"
            sizes="(max-width: 430px) 100vw, 430px"
          />
        </div>

        {/* 장소 정보 */}
        <div className="px-4 pt-4 pb-2 flex flex-col gap-3">
          {/* 카테고리 + 정보 불확실 경고 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{place.cat}</Badge>
            {place.availabilityUncertain && (
              <div className="flex items-center gap-1 text-point">
                <AlertTriangle size={12} strokeWidth={2} />
                <span className="text-[11px] font-medium">정보가 정확하지 않을 수 있어요</span>
              </div>
            )}
          </div>

          {/* 장소명 + 현재 배지 */}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[26px] font-bold text-text-primary leading-tight tracking-tight">
              {place.name}
            </h1>
            <Badge variant="secondary">현재</Badge>
          </div>

          {/* 주소 */}
          {place.addr && (
            <div className="flex items-start gap-1.5">
              <MapPin size={13} strokeWidth={2} className="text-text-secondary shrink-0 mt-0.5" />
              <span className="text-[13px] text-text-secondary leading-snug">{place.addr}</span>
            </div>
          )}

          {/* 설명 */}
          {!isBlank(place.desc) && (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setDescOpen((v) => !v)}
                className="self-start text-primary text-[12px] font-semibold hover:underline"
              >
                {descOpen ? "설명 접기" : "설명 보기"}
              </button>
              {descOpen && (
                <p className="text-[14px] text-text-secondary leading-relaxed">{place.desc}</p>
              )}
            </div>
          )}

          {/* 축제 전용 — 행사 프로그램. programInfo 없으면(장소이거나 Tour API 미매칭
              축제) 렌더하지 않는다. */}
          {place.programInfo && (
            <div className="flex flex-col gap-2 rounded-xl bg-card border border-border px-4 py-3">
              <p className="text-[12px] font-bold text-text-primary">행사 프로그램</p>
              <div>
                <p className="text-[11px] font-semibold text-text-secondary mb-0.5">
                  주요 프로그램
                </p>
                <p className="text-[13px] text-text-primary leading-snug whitespace-pre-line">
                  {place.programInfo.main}
                </p>
              </div>
              {place.programInfo.extra.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {place.programInfo.extra.map((item, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-0.5 rounded-full border border-border text-[11px] font-medium text-text-primary"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 날씨 예보 카드 — 비/눈이 임박했을 때만 표시 */}
          {rainAlert && (
            <div className="flex items-center gap-3 rounded-xl bg-card border border-border px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-point/10 flex items-center justify-center shrink-0">
                <CloudRain size={15} strokeWidth={2} className="text-point" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide mb-0.5">
                  곧 예보
                </p>
                <p className="text-[15px] font-bold text-text-primary">
                  {rainAlert.hoursAhead}시간 뒤 {rainAlert.condition === "snow" ? "눈" : "비"} 예상
                </p>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  우산을 챙기시는 걸 추천해요
                </p>
              </div>
            </div>
          )}

          {/* 체류 시간 카드 */}
          <div className="flex items-center gap-3 rounded-xl bg-card border border-border px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Clock size={15} strokeWidth={2} className="text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide mb-0.5">
                예상 체류
              </p>
              <p className="text-[15px] font-bold text-text-primary">{place.dur}</p>
              <p className="text-[11px] text-text-secondary mt-0.5">
                카테고리 평균 기준
              </p>
            </div>
          </div>

          {/* 축제 전용 — 공식 사이트 링크. organizerUrl 없으면 숨긴다. */}
          {place.organizerUrl && (
            <a
              href={place.organizerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start flex items-center gap-1.5 text-primary text-[13px] font-semibold"
            >
              <ExternalLink size={13} strokeWidth={2} />
              공식 사이트
            </a>
          )}

          {/* 태그 칩 */}
          {place.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {place.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full bg-card border border-border text-[12px] font-medium text-text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 주변 정보 — 예전엔 드로어를 열어야 보였지만, 여는 동작 자체가 불필요한
            액션이라 페이지에 바로 병합했다. POI는 드로어 여부와 무관하게 이미
            fetch돼 있어 기본값을 펼침으로 둬도 추가 대기 시간은 없다. 다만 내용이
            길어 화면을 많이 차지할 수 있어 접어둘 수 있게는 남겨뒀다. */}
        <div className="px-4 pt-4 pb-2 border-t border-border mt-2">
          <button
            type="button"
            onClick={() => setNearbyExpanded((v) => !v)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h2 className="text-[15px] font-bold text-text-primary">
              주변 정보
            </h2>
            <ChevronDown
              size={16}
              strokeWidth={2.2}
              className={cn(
                "text-text-secondary transition-transform",
                nearbyExpanded && "rotate-180",
              )}
            />
          </button>
          {nearbyExpanded && (
            <NearbyPanel
              placeName={place.name}
              placeCoord={placeCoord}
              cat={cat}
              setCat={setCat}
              pois={filteredPois}
              loading={poisLoading}
              selectedPoiId={selectedPoiId}
              onSelect={selectPoi}
            />
          )}
        </div>
      </div>

      {/* CTA 바 */}
      <div className="border-t border-border bg-background px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,8px))] shrink-0">
        <Button size="cta" className="w-full gap-2" onClick={handleComplete}>
          방문 완료
          <Check size={16} />
        </Button>
      </div>
    </>
  );
}
