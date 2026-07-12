"use client";

import { useState } from "react";
import { AlertCircle, ChevronLeft } from "lucide-react";
import { cn } from "@/shared/utils";

const REGION_CITIES: Record<string, { name: string; prov: string }[]> = {
  수도권: [
    { name: "서울", prov: "서울특별시" },
    { name: "인천", prov: "인천광역시" },
    { name: "수원", prov: "경기도" },
    { name: "용인", prov: "경기도" },
    { name: "고양", prov: "경기도" },
    { name: "성남", prov: "경기도" },
  ],
  중부권: [
    { name: "대전", prov: "대전광역시" },
    { name: "경주", prov: "경상북도" },
    { name: "청주", prov: "충청북도" },
    { name: "전주", prov: "전라북도" },
    { name: "춘천", prov: "강원도" },
    { name: "강릉", prov: "강원도" },
  ],
  영남권: [
    { name: "부산", prov: "부산광역시" },
    { name: "대구", prov: "대구광역시" },
    { name: "울산", prov: "울산광역시" },
    { name: "창원", prov: "경상남도" },
    { name: "포항", prov: "경상북도" },
    { name: "거제", prov: "경상남도" },
  ],
  호남권: [
    { name: "광주", prov: "광주광역시" },
    { name: "여수", prov: "전라남도" },
    { name: "순천", prov: "전라남도" },
    { name: "목포", prov: "전라남도" },
    { name: "군산", prov: "전라북도" },
    { name: "남원", prov: "전라북도" },
  ],
  "제주·강원": [
    { name: "제주", prov: "제주특별자치도" },
    { name: "서귀포", prov: "제주특별자치도" },
    { name: "강릉", prov: "강원도" },
    { name: "속초", prov: "강원도" },
    { name: "춘천", prov: "강원도" },
    { name: "평창", prov: "강원도" },
  ],
};

const REGIONS = ["수도권", "중부권", "영남권", "호남권", "제주·강원"] as const;
type Region = (typeof REGIONS)[number];

const KEYFRAMES = `
  @keyframes lp-slide-in-right {
    from { transform: translateX(30%); opacity: 0; }
    to   { transform: translateX(0);   opacity: 1; }
  }
  @keyframes lp-slide-in-left {
    from { transform: translateX(-30%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
`;

interface LocationDeniedViewProps {
  onCitySelect: (city: string, sidoName: string | null) => void;
  /** denied: 권한 거부/불가 배너 표시. manual: 배너 없이 단순 선택 UI */
  variant?: "denied" | "manual";
}

export function LocationDeniedView({
  onCitySelect,
  variant = "denied",
}: LocationDeniedViewProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [region, setRegion] = useState<Region | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [panelKey, setPanelKey] = useState(0);
  const [enterAnim, setEnterAnim] = useState<
    "none" | "from-right" | "from-left"
  >("none");

  const goToStep2 = (r: Region) => {
    setRegion(r);
    setCity(null);
    setEnterAnim("from-right");
    setPanelKey((k) => k + 1);
    setStep(2);
  };

  const backToStep1 = () => {
    setEnterAnim("from-left");
    setPanelKey((k) => k + 1);
    setStep(1);
  };

  const panelStyle: React.CSSProperties =
    enterAnim === "from-right"
      ? { animation: "lp-slide-in-right 250ms ease-in-out both" }
      : enterAnim === "from-left"
        ? { animation: "lp-slide-in-left 250ms ease-in-out both" }
        : {};

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div className="flex-1 overflow-hidden relative">
        <div
          key={panelKey}
          className="absolute inset-0 overflow-y-auto"
          style={panelStyle}
        >
          {step === 1 ? (
            <Step1 onPickRegion={goToStep2} showAlert={variant === "denied"} />
          ) : (
            <Step2
              region={region!}
              city={city}
              setCity={setCity}
              onBack={backToStep1}
            />
          )}
        </div>
      </div>

      {step === 2 && (
        <div className="border-t border-border bg-background px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,8px))]">
          {city ? (
            <button
              onClick={() => {
                const cityData = REGION_CITIES[region!]?.find((c) => c.name === city);
                onCitySelect(city, cityData?.prov ?? null);
              }}
              className="w-full h-12.5 rounded-[10px] bg-accent text-white text-[15px] font-bold tracking-tight"
            >
              이 도시로 코스 뽑기
            </button>
          ) : (
            <button
              disabled
              className="w-full h-12.5 rounded-[10px] bg-muted-foreground text-white text-[15px] font-semibold opacity-40 cursor-not-allowed"
            >
              도시를 선택해주세요
            </button>
          )}
        </div>
      )}
    </>
  );
}

function Step1({
  onPickRegion,
  showAlert,
}: {
  onPickRegion: (r: Region) => void;
  showAlert: boolean;
}) {
  return (
    <div className="px-4 pt-5 pb-6">
      {showAlert && (
        <div className="flex gap-2.5 items-start px-3.5 py-3 rounded-[10px] bg-point/12 border border-point/20 mb-6">
          <AlertCircle
            size={18}
            className="text-point shrink-0 mt-0.5"
            strokeWidth={2}
          />
          <div>
            <p className="text-[13px] font-bold text-text-primary mb-0.5">
              위치 권한이 거부되었어요
            </p>
            <p className="text-[12px] text-text-secondary leading-[1.4]">
              지역을 직접 선택해주세요
            </p>
          </div>
        </div>
      )}

      <p className="text-[14px] font-bold text-text-primary tracking-tight mb-3">
        어느 지역에 계세요?
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {REGIONS.map((r, i) => (
          <button
            key={r}
            onClick={() => onPickRegion(r)}
            className={cn(
              "py-4 px-3 rounded-xl border border-border bg-surface text-[14px] font-medium text-text-primary text-center tracking-tight transition-colors active:scale-[0.98]",
              i === 4 ? "col-span-2" : "",
            )}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

function Step2({
  region,
  city,
  setCity,
  onBack,
}: {
  region: Region;
  city: string | null;
  setCity: (c: string) => void;
  onBack: () => void;
}) {
  const cities = REGION_CITIES[region] ?? [];

  return (
    <div className="px-4 pt-3.5 pb-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-primary text-[12px] font-medium pb-2 mb-1"
      >
        <ChevronLeft size={14} /> 권역 다시 선택
      </button>
      <p className="text-[11px] text-text-secondary mb-4">
        {region} <span className="mx-1">›</span> 도시 선택
      </p>

      <p className="text-[14px] font-bold text-text-primary tracking-tight mb-3">
        도시를 선택해주세요
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {cities.map((c) => {
          const sel = city === c.name;
          return (
            <button
              key={c.name}
              onClick={() => setCity(c.name)}
              className={cn(
                "py-3.5 px-3 rounded-xl border text-center transition-colors active:scale-[0.98]",
                sel ? "bg-accent/9 border-accent" : "bg-surface border-border",
              )}
            >
              <p
                className={cn(
                  "text-[13px] font-bold tracking-tight mb-0.5",
                  sel ? "text-accent" : "text-text-primary",
                )}
              >
                {c.name}
              </p>
              <p
                className={cn(
                  "text-[11px]",
                  sel ? "text-accent opacity-80" : "text-text-secondary",
                )}
              >
                {c.prov}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
