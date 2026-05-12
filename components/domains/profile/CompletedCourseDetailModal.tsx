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

type Place = { name: string; category: string };

export type CompletedCourse = {
  name: string;
  date: string;
  region: string;
  duration: string;
  places: Place[];
  xp: number;
  rating: number;
  review: string;
};

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
              {course.date} · {course.region} · {course.duration} 소요
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
              <div className="flex flex-col gap-2">
                {course.places.map((place, i) => (
                  <div key={place.name} className="flex items-center gap-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      {i + 1}
                    </div>
                    <MapPin size={13} className="shrink-0 text-text-secondary" />
                    <span className="flex-1 text-[14px] text-text-primary">
                      {place.name}
                    </span>
                    <Badge variant="secondary">{place.category}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* 획득 XP / 평점 */}
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-text-secondary">획득 XP</span>
                <span className="text-[13px] font-semibold text-primary">
                  +{course.xp} XP
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-text-secondary">평점</span>
                <StarRating rating={course.rating} />
              </div>
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
