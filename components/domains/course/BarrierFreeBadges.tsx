"use client";

import { useState } from "react";
import { Accessibility, Baby, ChevronDown, Ear, Eye } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/utils";
import { Badge } from "@/components/commons/Badge";
import { useBarrierFreeQuery } from "@/client/hooks/useBarrierFreeQuery";
import type { BarrierFreeGroup, BarrierFreeGroupKey } from "@/shared/types/course.types";

const GROUP_COPY: Record<BarrierFreeGroupKey, { icon: LucideIcon; text: string }> = {
  mobility: { icon: Accessibility, text: "휠체어·이동" },
  visual: { icon: Eye, text: "시각" },
  hearing: { icon: Ear, text: "청각" },
  infant: { icon: Baby, text: "영유아 동반" },
};

// 같은 그룹 안에서 배지 문구가 겹치는 항목(접근로·출입통로 → "휠체어 접근")은 한 번만 띄운다.
function badgeLabels(group: BarrierFreeGroup): string[] {
  return [...new Set(group.facilities.flatMap((f) => f.labels))];
}

// 배지로 요약할 키워드가 없는 원문만 있는 그룹용 — 그 원문엔 편의시설이 아니라 주의사항
// ("활동보조 필요")도 섞여 있어 "편의시설"이라고 단정하지 않고, 시설 배지와 구분되는
// 중립 톤으로 상세 목록에 내용이 있다는 사실만 알린다.
const NOTE_ONLY_LABEL = "안내 사항 있음";

type Props = {
  placeId: string;
};

// 코스 추천 화면의 무장애 편의시설 배지. 조회 중·실패·정보 없음은 모두 렌더하지 않는다 —
// 무장애 정보는 일부 장소에만 있는 보조 정보라, "없음"을 따로 알리면 오히려 장소 자체가
// 이용 불가능하다는 오해를 준다. 장소가 바뀌면 부모가 key로 리마운트해 펼침 상태를 초기화한다.
export function BarrierFreeBadges({ placeId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { data: groups } = useBarrierFreeQuery(placeId);

  if (!groups || groups.length === 0) return null;

  return (
    <section aria-label="무장애 편의시설" className="mt-4 pt-4 border-t border-dashed border-border">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-bold text-text-primary">무장애 편의시설</p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex items-center gap-0.5 text-[12px] font-medium text-text-secondary"
        >
          {expanded ? "접기" : "자세히"}
          <ChevronDown
            size={14}
            className={cn("transition-transform", expanded && "rotate-180")}
          />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {groups.map((group) => {
          const { icon: Icon, text } = GROUP_COPY[group.group];
          const labels = badgeLabels(group);
          return (
            <div key={group.group} className="flex items-start gap-2">
              <span className="flex items-center gap-1 shrink-0 w-21 pt-0.5 text-[11px] font-semibold text-text-secondary">
                <Icon size={14} strokeWidth={2} />
                {text}
              </span>
              <div className="flex flex-wrap gap-1">
                {labels.map((label) => (
                  <Badge
                    key={label}
                    variant="outline"
                    className="border-primary/25 bg-primary/5 text-primary text-[11.5px]"
                  >
                    {label}
                  </Badge>
                ))}
                {labels.length === 0 && (
                  <Badge variant="outline" className="text-text-secondary text-[11.5px]">
                    {NOTE_ONLY_LABEL}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {expanded && (
        <dl className="mt-3 flex flex-col gap-2.5 rounded-xl bg-muted/50 px-3.5 py-3">
          {groups.flatMap((group) =>
            group.facilities.map((f, i) => (
              <div key={`${group.group}-${i}`}>
                <dt className="text-[11px] font-semibold text-text-secondary mb-0.5">
                  {GROUP_COPY[group.group].text} · {f.name}
                </dt>
                <dd className="text-[13px] leading-[1.5] text-text-primary whitespace-pre-line">
                  {f.detail}
                </dd>
              </div>
            )),
          )}
        </dl>
      )}
      <p className="mt-2 text-[10.5px] text-text-secondary/80">
        한국관광공사 무장애 여행 정보 기준 · 방문 전 현장 확인을 권장해요
      </p>
    </section>
  );
}
