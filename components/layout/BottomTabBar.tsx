"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Home, User } from "lucide-react";

const TABS = [
  { href: "/", icon: Home, label: "홈" },
  { href: "/start", icon: Zap, label: "시작" },
  { href: "/profile", icon: User, label: "내 정보" },
];

const TAB_PATHS = ["/", "/profile"];

export function BottomTabBar() {
  const pathname = usePathname();

  if (!TAB_PATHS.includes(pathname)) return null;

  return (
    <nav className="flex items-end bg-background border-t border-border pb-[env(safe-area-inset-bottom,6px)] shrink-0">
      {TABS.map(({ href, icon: Icon, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center gap-0.5 py-2"
          >
            <Icon
              size={22}
              strokeWidth={active ? 2.4 : 2}
              className={active ? "text-primary" : "text-muted-foreground"}
            />
            <span
              className={`text-[11px] ${
                active
                  ? "font-semibold text-primary"
                  : "font-medium text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
