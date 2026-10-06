"use client";

import { Bell } from "lucide-react";
import Link from "next/link";

interface NotificationBellProps {
  unreadCount: number;
}

export function NotificationBell({ unreadCount }: NotificationBellProps) {
  return (
    <Link
      href="/notifications"
      prefetch={false}
      aria-label={
        unreadCount > 0
          ? `Notifications: ${unreadCount} unread`
          : "Notifications: none unread"
      }
      className="relative p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <Bell className="w-5 h-5" aria-hidden="true" />
      {unreadCount > 0 && (
        <span
          data-testid="notification-badge"
          className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white shadow"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
