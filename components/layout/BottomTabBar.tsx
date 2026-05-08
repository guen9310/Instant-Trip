"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Compass, User } from "lucide-react";

const TAB_PATHS = ["/start", "/feed", "/profile"];

export function BottomTabBar() {
  const pathname = usePathname();

  if (!TAB_PATHS.includes(pathname)) return null;

  const isActive = (href: string) => pathname === href;

  return (
    <nav className="relative flex items-end bg-background border-t border-border pb-[env(safe-area-inset-bottom,6px)] shrink-0">
      {/* 피드 - 좌측 */}
      <Link
        href="/feed"
        className="flex-1 flex flex-col items-center gap-0.5 py-2"
      >
        <Compass
          size={22}
          strokeWidth={isActive("/feed") ? 2.4 : 2}
          className={
            isActive("/feed") ? "text-primary" : "text-muted-foreground"
          }
        />
        <span
          className={`text-[11px] ${
            isActive("/feed")
              ? "font-semibold text-primary"
              : "font-medium text-muted-foreground"
          }`}
        >
          피드
        </span>
      </Link>

      {/* 중앙 공간 확보 */}
      <div className="w-20 shrink-0" />

      {/* 내 정보 - 우측 */}
      <Link
        href="/profile"
        className="flex-1 flex flex-col items-center gap-0.5 py-2"
      >
        <User
          size={22}
          strokeWidth={isActive("/profile") ? 2.4 : 2}
          className={
            isActive("/profile") ? "text-primary" : "text-muted-foreground"
          }
        />
        <span
          className={`text-[11px] ${
            isActive("/profile")
              ? "font-semibold text-primary"
              : "font-medium text-muted-foreground"
          }`}
        >
          내 정보
        </span>
      </Link>

      {/* 시작 - 중앙 돌출 버튼 */}
      <Link
        href="/start"
        className="absolute left-1/2 -translate-x-1/2 bottom-2 flex flex-col items-center gap-1"
      >
        <span
          className={`flex items-center justify-center w-14 h-14 rounded-full bg-primary shadow-md ${
            isActive("/start") ? "ring-2 ring-primary/30 ring-offset-2" : ""
          }`}
        >
          <Zap size={24} strokeWidth={2.2} className="text-white" />
        </span>
        <span
          className={`text-[11px] ${
            isActive("/start")
              ? "font-semibold text-primary"
              : "font-medium text-muted-foreground"
          }`}
        >
          시작
        </span>
      </Link>
    </nav>
  );
}
