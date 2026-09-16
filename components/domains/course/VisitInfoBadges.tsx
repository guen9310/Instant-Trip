"use client";

import { Accessibility, Baby, Ear, Eye, PawPrint } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/commons/Badge";
import { useBarrierFreeQuery } from "@/client/hooks/useBarrierFreeQuery";
import { usePetTourQuery } from "@/client/hooks/usePetTourQuery";
import type { BarrierFreeGroupKey, PetTourInfo, PetZone } from "@/shared/types/course.types";

const BARRIER_FREE_ROW: Record<BarrierFreeGroupKey, { icon: LucideIcon; text: string }> = {
  mobility: { icon: Accessibility, text: "휠체어·이동" },
  visual: { icon: Eye, text: "시각" },
  hearing: { icon: Ear, text: "청각" },
  infant: { icon: Baby, text: "영유아 동반" },
};

const PET_ZONE_LABEL: Record<PetZone, string> = {
  all: "전 구역 동반",
  partial: "일부 구역만",
};

const POSITIVE_BADGE = "border-primary/25 bg-primary/5 text-primary text-[11.5px]";
const NEUTRAL_BADGE = "text-text-secondary text-[11.5px]";

type BadgeItem = { label: string; tone: "positive" | "neutral" };

// 반려동물 한 줄 — 동반 가능하다는 사실(전 구역·크기)은 긍정 톤, 제약(일부 구역만·착용/지참
// 요구)은 중립 톤으로 나눠 같은 줄에서도 "되는 것"과 "조건"이 섞여 보이지 않게 한다.
function petBadges(info: PetTourInfo): BadgeItem[] {
  return [
    ...(info.zone
      ? [{ label: PET_ZONE_LABEL[info.zone], tone: info.zone === "all" ? "positive" : "neutral" } as const]
      : []),
    ...(info.sizeLabel ? [{ label: info.sizeLabel, tone: "positive" } as const] : []),
    ...info.needLabels.map((label) => ({ label, tone: "neutral" }) as const),
  ];
}

function Row({ icon: Icon, text, badges }: { icon: LucideIcon; text: string; badges: BadgeItem[] }) {
  return (
    <div className="flex items-start gap-2">
      <span className="flex items-center gap-1 shrink-0 w-21 pt-0.5 text-[11px] font-semibold text-text-secondary">
        <Icon size={14} strokeWidth={2} />
        {text}
      </span>
      <div className="flex flex-wrap gap-1">
        {badges.map(({ label, tone }) => (
          <Badge
            key={label}
            variant="outline"
            className={tone === "positive" ? POSITIVE_BADGE : NEUTRAL_BADGE}
          >
            {label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

type Props = {
  placeId: string;
};

// 코스 추천 화면의 방문 조건 블록 — 무장애 편의시설(KorWithService2)과 반려동물 동반 조건
// (KorPetTourService2)을 제목 하나 아래 줄로 합친다. 둘 다 "누구와 함께 갈 수 있나"를 답하는
// 같은 성격의 보조 정보라 섹션을 따로 두면 제목·구분선만 늘어난다.
// 정보 없음·조회 실패는 줄 자체를 빼고, 둘 다 없으면 블록을 렌더하지 않는다 — "없음"을 알리면
// 이용 불가로 오해된다. 두 조회가 따로 끝나며 블록이 두 번 밀리지 않도록 둘 다 끝난 뒤 렌더한다.
export function VisitInfoBadges({ placeId }: Props) {
  const barrierFree = useBarrierFreeQuery(placeId);
  const petTour = usePetTourQuery(placeId);

  // isLoading = 실제로 요청 중인 첫 조회. TourAPI id가 아니라 조회가 꺼진 경우엔 false다.
  if (barrierFree.isLoading || petTour.isLoading) return null;

  const groups = barrierFree.data ?? [];
  const pet = petTour.data ?? null;
  if (groups.length === 0 && !pet) return null;

  return (
    <section aria-label="알아두면 좋아요" className="mt-4 pt-4 border-t border-dashed border-border">
      <p className="mb-2 text-[13px] font-bold text-text-primary">알아두면 좋아요</p>

      <div className="flex flex-col gap-2">
        {groups.map((group) => (
          <Row
            key={group.group}
            {...BARRIER_FREE_ROW[group.group]}
            badges={group.labels.map((label) => ({ label, tone: "positive" }))}
          />
        ))}
        {pet && <Row icon={PawPrint} text="반려동물" badges={petBadges(pet)} />}
      </div>
    </section>
  );
}
