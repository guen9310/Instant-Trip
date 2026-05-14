"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Map } from "lucide-react";
import { Button } from "@/components/commons/Button";
import { LocationPermissionSheet } from "@/components/domains/location/LocationPermissionSheet";
import { usePrefsStore } from "@/client/stores/usePrefsStore";
import { buildProfileSummary } from "@/shared/utils/prefsText";

export function OnboardingDoneView() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const router = useRouter();

  const prefs = usePrefsStore((s) => s.prefs);
  const profile = buildProfileSummary(prefs);

  const handleAllow = () => {
    setSheetOpen(false);
    // TODO: 실제 위치 권한 요청 (navigator.geolocation.requestPermission)
    router.push("/start");
  };

  return (
    <div className="flex min-h-svh flex-col bg-background px-6">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {/* 아이콘 */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-primary/8 flex items-center justify-center">
            <Map size={36} className="text-primary" strokeWidth={2} />
          </div>
          <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-accent flex items-center justify-center text-white text-[14px]">
            ✓
          </span>
        </div>

        {/* 헤딩 */}
        <h1 className="text-[28px] font-extrabold text-text-primary tracking-[-0.03em] leading-[1.15] mb-3 text-balance">
          준비됐어요!
        </h1>
        <p className="text-[14px] text-text-secondary leading-[1.55] mb-8 text-balance">
          설정한 취향을 바탕으로 코스를 만들어드릴게요.
        </p>

        {/* 취향 프로필 */}
        <div className="w-full rounded-xl bg-surface border border-border px-5 py-5 text-left mb-10">
          <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.05em] mb-3">
            당신의 여행 스타일
          </p>
          <p className="text-[15px] text-text-primary leading-[1.75]">
            {profile.vibe}
            <br />
            {profile.preference}
          </p>
          <p className="text-[14px] text-text-secondary leading-[1.75] mt-2">
            {profile.recommend}
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="pb-[calc(24px+env(safe-area-inset-bottom,8px))]">
        <p className="mb-3 text-center text-[12px] text-text-secondary">
          취향 변경은 프로필에서 언제든 가능해요
        </p>
        <Button
          size="cta"
          className="w-full"
          onClick={() => setSheetOpen(true)}
        >
          지금 떠나보기
        </Button>
        <Link
          href="/feed"
          className="block text-center mt-3 py-2 text-[13px] text-text-secondary font-medium"
        >
          둘러보기
        </Link>
      </div>

      <LocationPermissionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onAllow={handleAllow}
      />
    </div>
  );
}
