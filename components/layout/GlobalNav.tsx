"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, Monitor, Moon, Sun } from "lucide-react";
import { useDarkModeStore } from "@/client/stores/useDarkModeStore";
import type { User } from "@/shared/types/auth.types";

const TAB_PATHS = ["/", "/feed", "/profile"];

const PAGE_TITLES: Record<string, string> = {
  "/profile": "내 정보",
  "/settings": "취향 설정",
};

export function GlobalNav({ user }: { user: User | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, cycleTheme } = useDarkModeStore();

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const nextLabel =
    theme === "light"
      ? "다크 모드로 전환"
      : theme === "dark"
        ? "시스템 설정으로 전환"
        : "라이트 모드로 전환";

  const isTabPage = TAB_PATHS.includes(pathname);
  const title = PAGE_TITLES[pathname];
  const showBack = !isTabPage;

  return (
    <nav className="sticky top-0 z-30 flex items-center justify-between h-[52px] px-4 bg-background border-b border-border shrink-0">
      <div className="flex items-center gap-1 min-w-0">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="-ml-1 p-1 text-text-primary"
            aria-label="뒤로 가기"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        {title ? (
          <span className="text-[16px] font-semibold text-text-primary">
            {title}
          </span>
        ) : (
          <Link
            href="/"
            className="text-[17px] font-extrabold text-primary tracking-tight"
          >
            지금어때
          </Link>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={cycleTheme}
          className="p-1.5 text-text-primary"
          aria-label={nextLabel}
        >
          <ThemeIcon size={18} />
        </button>
        {user ? (
          <Link
            href="/profile"
            className="relative w-[30px] h-[30px] rounded-full overflow-hidden shrink-0"
            aria-label="내 정보"
          >
            <Image
              src={user.image ?? "/images/profile.svg"}
              alt={user.name}
              fill
              sizes="30px"
              className="object-cover"
            />
          </Link>
        ) : (
          <Link
            href="/sign-in"
            className="px-2 py-1 text-[13px] font-medium text-primary"
            aria-label="로그인"
          >
            로그인
          </Link>
        )}
      </div>
    </nav>
  );
}
