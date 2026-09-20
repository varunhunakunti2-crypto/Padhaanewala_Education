"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Building2, Scale, UserRound, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/context/AppContext";

const ITEMS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Colleges", href: "/colleges", icon: Building2 },
  { label: "Compare", href: "/compare", icon: Scale },
  { label: "Saved", href: "/dashboard?tab=saved", icon: Heart },
  { label: "Profile", href: "/dashboard", icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  const { compareList, savedColleges } = useApp();

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-purple-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : item.href.includes("?")
                ? pathname.startsWith(item.href.split("?")[0]!)
                : pathname.startsWith(item.href);
          const badge =
            item.href === "/compare" ? compareList.length : item.href === "/dashboard?tab=saved" ? 0 : 0;
          const badgeSaved = item.href.endsWith("saved") ? savedColleges.length : 0;
          const Icon = item.icon;
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                aria-label={item.label}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-purple-700" : "text-gray-400 hover:text-purple-600",
                )}
              >
                <span className="relative">
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                  {(badge > 0 || badgeSaved > 0) && (
                    <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white">
                      {badge || badgeSaved}
                    </span>
                  )}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}