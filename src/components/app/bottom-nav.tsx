"use client";

import {
  BookOpen,
  Calendar,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Settings,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

const ICON_MAP = {
  dashboard: LayoutDashboard,
  users: Users,
  settings: Settings,
  courses: BookOpen,
  grades: GraduationCap,
  assignments: BookOpen,
  calendar: Calendar,
  upload: Upload,
  layers: Layers,
};

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 z-40 safe-bottom"
    >
      <div className="flex items-center justify-around px-2 h-16 max-w-md mx-auto">
        {items.map((item) => {
          const Icon = ICON_MAP[item.iconName] || LayoutDashboard;
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={`flex flex-col items-center justify-center flex-1 min-h-[44px] min-w-[44px] py-1 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isActive
                  ? "text-indigo-400 font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-5 h-5 mb-1 shrink-0" aria-hidden="true" />
              <span className="text-[10px] tracking-tight truncate max-w-[70px]">
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
