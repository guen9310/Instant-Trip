"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Compass, User } from "lucide-react";

const tabs = [
  { href: "/start", label: "시작", icon: Zap },
  { href: "/feed", label: "피드", icon: Compass },
  { href: "/profile", label: "내 정보", icon: User },
];

const TAB_PATHS = tabs.map((t) => t.href);

export function BottomTabBar() {
  const pathname = usePathname();

  if (!TAB_PATHS.includes(pathname)) return null;

  return (
    <nav className="flex bg-background border-t border-border pb-[env(safe-area-inset-bottom,6px)] shrink-0">
      {tabs.map(({ href, label, icon: Icon }) => {
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
