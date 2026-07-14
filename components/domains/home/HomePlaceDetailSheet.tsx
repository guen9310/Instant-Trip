"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/commons/Drawer";
import { Badge } from "@/components/commons/Badge";
import { Button } from "@/components/commons/Button";
import { PlaceThumbnail } from "@/components/domains/course/PlaceThumbnail";
import { generateCourseFromPlaceAction } from "@/app/actions/course";
import type { TourItem } from "@/lib/tour/types";
import type { PendingCourse } from "@/shared/types/course.types";
import { isBlank } from "@/shared/utils";

// HomeView의 TYPE_LABEL과 동일 — 근처 장소 카드가 이미 보여주는 정보 수준을 유지한다.
const TYPE_LABEL: Record<string, string> = {
  "12": "관광지",
  "14": "문화시설",
  "28": "레포츠",
};

type Props = {
  place: TourItem | null;
  onClose: () => void;
};

// 홈 근처 장소 카드 탭 → 장소 상세 시트. areaBasedList2가 이미 준 필드만 보여주고,
// 추가 API 호출은 하지 않는다 — 상세 데이터는 "이 장소로 코스 시작" 시 액션이 가져온다.
export function HomePlaceDetailSheet({ place, onClose }: Props) {
  return (
    <Drawer open={!!place} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DrawerContent>
        <DrawerTitle className="sr-only">{place?.title ?? "장소 상세"}</DrawerTitle>
        {place && <HomePlaceDetailContent key={place.contentid} place={place} />}
      </DrawerContent>
    </Drawer>
  );
}

function HomePlaceDetailContent({ place }: { place: TourItem }) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const catLabel = TYPE_LABEL[place.contenttypeid] ?? "장소";

  const handleStart = async () => {
    setStarting(true);
    setError(null);

    // 이 장소 자체의 좌표를 기준으로 코스를 만든다(사용자 현재 위치가 아니다) —
    // 축제 첨부도 이 좌표를 중심으로 이뤄진다.
    const lat = parseFloat(place.mapy);
    const lng = parseFloat(place.mapx);

    const result = await generateCourseFromPlaceAction({
      contentId: place.contentid,
      contentTypeId: place.contenttypeid,
      lat,
      lng,
    });

    if (!result.ok) {
      setStarting(false);
      setError(
        result.code === "NOT_FOUND"
          ? "장소 정보를 찾을 수 없어요. 다른 장소를 선택해주세요."
          : "코스를 만드는 중 문제가 발생했어요. 다시 시도해주세요.",
      );
      return;
    }

    const pending: PendingCourse = {
      courseId: result.courseId,
      place: result.place,
      courseName: result.courseName,
      festivals: result.festivals,
      mapX: lng,
      mapY: lat,
      availability: result.availability,
    };
    localStorage.setItem("pendingCourse", JSON.stringify(pending));
    router.push("/course/preview");
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="px-5">
          <PlaceThumbnail
            imageUrl={isBlank(place.firstimage) ? null : place.firstimage}
            cat={catLabel}
            className="w-full h-44 rounded-xl"
            sizes="100vw"
          />
        </div>
        <div className="px-5 pt-3">
          <Badge variant="secondary">{catLabel}</Badge>
          <h2 className="text-[22px] font-bold text-text-primary tracking-tight mt-2">
            {place.title}
          </h2>
          {place.addr1 && (
            <div className="flex items-center gap-2.5 mt-3">
              <MapPin size={16} className="text-text-secondary shrink-0" />
              <span className="text-[14px] text-text-primary">{place.addr1}</span>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom,8px))] flex flex-col gap-2">
        {error && (
          <div className="flex items-start gap-2 text-point">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <p className="text-[13px] leading-snug">{error}</p>
          </div>
        )}
        <Button size="cta" onClick={handleStart} disabled={starting}>
          {starting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> 코스를 만드는 중...
            </span>
          ) : (
            "이 장소로 코스 시작"
          )}
        </Button>
      </div>
    </div>
  );
}
