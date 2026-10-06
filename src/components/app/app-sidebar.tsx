"use client";

import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Actor } from "@/lib/auth/session";
import type { NavItem } from "@/lib/nav";
import type { Role } from "@/modules/identity/schema";
import { RoleSwitcher } from "./role-switcher";

const ICON_MAP = {
  dashboard: LayoutDashboard,
  users: Users,
  settings: Settings,
  courses: BookOpen,
  grades: GraduationCap,
  assignments: BookOpen,
};

export function AppSidebar({
  actor,
  activeRole,
  items,
  portalTitle,
}: {
  actor: Actor;
  activeRole: Role;
  items: NavItem[];
  portalTitle: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const { authClient } = await import("@/lib/auth/client");
      await authClient.signOut();
      router.push("/sign-in");
    } catch {
      window.location.href = "/sign-in";
    }
  };

  return (
    <aside
      aria-label="Desktop Navigation"
      className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-zinc-950 border-r border-zinc-800 z-30"
    >
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-zinc-800 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-500/20">
            BC
          </div>
          <div className="min-w-0">
            <span className="block font-bold text-sm text-white truncate tracking-tight">
              BQLMS
            </span>
            <span className="block text-xs text-zinc-400 truncate">
              {portalTitle}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav
          aria-label="Main Navigation"
          className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto"
        >
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
                className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 font-semibold"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${
                    isActive ? "text-white" : "text-zinc-400"
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Switcher Footer */}
        <div className="p-4 border-t border-zinc-800 space-y-3 shrink-0">
          <RoleSwitcher roles={actor.roles} activeRole={activeRole} />

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">
                {actor.name}
              </p>
              <p className="text-xs text-zinc-400 truncate">{actor.email}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign Out"
              aria-label="Sign out of account"
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <LogOut className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
