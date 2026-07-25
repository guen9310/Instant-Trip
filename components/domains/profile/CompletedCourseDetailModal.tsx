"use client";

import { MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/commons/Dialog";
import { Badge } from "@/components/commons/Badge";
import { StarRating } from "@/components/domains/profile/StarRating";
import type { CompletedCourse } from "@/shared/types/course.types";

// 카카오 로컬 출처 장소는 실제 place.map.kakao.com 상세 페이지로 연결한다.
// 그 외(TourAPI 출처 등 placeUrl이 없는 경우)는 CourseActiveView의 "길찾기"와 동일하게
// 좌표 기반 map.kakao.com/link/map 링크로 폴백한다 — 이름+좌표만 있으면 출처 무관하게
// 정확히 동작해서, 텍스트 검색보다 신뢰도가 높다. 좌표조차 없는 아주 오래된 데이터만
// 최후 수단으로 이름+주소 검색 링크를 쓴다.
function kakaoPlaceUrl(place: {
  name: string;
  address: string;
  coord: { lat: number; lng: number } | null;
  placeUrl: string | null;
}): string {
  if (place.placeUrl) return place.placeUrl;
  if (place.coord) {
    return `https://map.kakao.com/link/map/${encodeURIComponent(place.name)},${place.coord.lat},${place.coord.lng}`;
  }
  const query = place.address ? `${place.name} ${place.address}` : place.name;
  return `https://map.kakao.com/?q=${encodeURIComponent(query)}`;
}

type Props = {
  course: CompletedCourse | null;
  onClose: () => void;
};

export function CompletedCourseDetailModal({ course, onClose }: Props) {
  return (
    <Dialog open={course !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{course?.name}</DialogTitle>
          {course && (
            <p className="text-[12px] text-text-secondary">
              {course.date} · {course.duration} 소요
            </p>
          )}
        </DialogHeader>

        {course && (
          <div className="flex flex-col gap-4">
            {/* 장소 */}
            <div>
              <p className="mb-2 text-[12px] font-semibold text-text-secondary">
                장소
              </p>
              <div className="flex flex-col gap-3">
                {course.places.map((place, i) => (
                  <div key={place.name} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                        {i + 1}
                      </div>
                      <span className="flex-1 text-[14px] text-text-primary">
                        {place.name}
                      </span>
                      <Badge variant={place.badge.variant}>
                        {place.badge.text}
                      </Badge>
                    </div>
                    {place.address && (
                      <div className="ml-7 flex items-center gap-1 text-[12px] text-text-secondary">
                        <MapPin size={11} className="shrink-0" />
                        <a
                          href={kakaoPlaceUrl(place)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2"
                        >
                          {place.address}
                        </a>
                      </div>
                    )}
                    {place.availabilityUncertain && (
                      <p className="ml-7 text-[11px] text-text-secondary/70">
                        운영시간 확인 불가로 추천됐던 장소예요
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 평점 */}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-[13px] text-text-secondary">평점</span>
              <StarRating rating={course.rating} />
            </div>

            {/* 후기 */}
            {course.review && (
              <div className="rounded-lg bg-muted px-3 py-2.5">
                <p className="text-[13px] text-text-primary">
                  &ldquo;{course.review}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
