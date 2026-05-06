"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

const TAB_PATHS = ["/", "/feed", "/profile"];

const PAGE_TITLES: Record<string, string> = {
  "/profile": "내 정보",
  "/settings": "취향 설정",
};

export function GlobalNav() {
  const pathname = usePathname();
  const router = useRouter();

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
      <Link
        href="/profile"
        className="w-[30px] h-[30px] rounded-full bg-primary text-white flex items-center justify-center text-[13px] font-bold shrink-0"
        aria-label="내 정보"
      >
        U
      </Link>
    </nav>
  );
}
