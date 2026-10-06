"use client";

import { Bell, Check, CheckCheck, ExternalLink, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDate } from "@/lib/datetime";
import type { Notification } from "@/modules/notifications";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/modules/notifications/actions";

const CATEGORY_LABELS: Record<string, string> = {
  security: "Account & Security",
  payment: "Billing & Financial",
  exam: "Exams & Tests",
  deadline: "Urgent Deadlines",
  announcement: "Campus Announcements",
  content: "Course Materials",
  grade: "Grades & Evaluation",
  forum: "Discussion Forums",
  message: "Direct Messages",
  absence: "Attendance & Absences",
  reminder: "General Reminders",
};

interface NotificationsViewProps {
  notifications: Notification[];
}

export function NotificationsView({ notifications }: NotificationsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const handleMarkAsRead = (notificationId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await markNotificationRead({ notificationId });
      if (!res.ok) {
        setError(res.error.message || "Failed to mark notification as read");
        return;
      }
      router.refresh();
    });
  };

  const handleMarkAllAsRead = () => {
    setError(null);
    startTransition(async () => {
      const res = await markAllNotificationsRead({});
      if (!res.ok) {
        setError(res.error.message || "Failed to mark all as read");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Notifications Center
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Institutional announcements, deadlines, academic updates, and
            alerts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/settings/notifications"
            prefetch={false}
            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-sm font-medium text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Settings className="w-4 h-4 text-zinc-400" aria-hidden="true" />
            <span>Preferences</span>
          </Link>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <CheckCheck className="w-4 h-4" aria-hidden="true" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-zinc-800/60 flex items-center justify-center text-zinc-400 mb-4">
            <Bell className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-white">
            No notifications yet
          </h2>
          <p className="text-sm text-zinc-400 mt-1 max-w-sm mx-auto">
            You're all caught up! New notices and deadlines will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const isUnread = !notification.readAt;
            const categoryLabel =
              CATEGORY_LABELS[notification.category] ?? notification.category;

            return (
              <div
                key={notification.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  isUnread
                    ? "bg-zinc-900/90 border-indigo-500/40 shadow-sm"
                    : "bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-900/60"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                        {categoryLabel}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {formatDate(notification.createdAt)}
                      </span>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      )}
                    </div>

                    {(() => {
                      const notifData =
                        (notification.data as Record<string, unknown>) ?? {};
                      const notifTitle = String(
                        notifData.title || "Notification",
                      );
                      const notifBody = String(notifData.body || "");
                      const notifLink =
                        typeof notifData.link === "string"
                          ? notifData.link
                          : null;

                      return (
                        <>
                          <h3 className="text-base font-semibold text-white">
                            {notifTitle}
                          </h3>
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            {notifBody}
                          </p>

                          {notifLink && (
                            <div className="pt-2">
                              <Link
                                href={notifLink}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300"
                              >
                                <span>View details</span>
                                <ExternalLink
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                              </Link>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => handleMarkAsRead(notification.id)}
                      disabled={isPending}
                      title="Mark as read"
                      aria-label="Mark notification as read"
                      className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <Check className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
