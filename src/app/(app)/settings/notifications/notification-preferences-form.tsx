"use client";

import { Mail, MessageSquare, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ALL_CATEGORIES,
  type NotificationPreference,
} from "@/modules/notifications";
import { updateNotificationPreferences } from "@/modules/notifications/actions";

interface NotificationPreferencesFormProps {
  initialPreferences: NotificationPreference[];
}

export function NotificationPreferencesForm({
  initialPreferences,
}: NotificationPreferencesFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Map initial preferences
  const [prefs, setPrefs] = useState(() => {
    const map = new Map<string, { email: boolean; push: boolean }>();
    for (const cat of ALL_CATEGORIES) {
      const existing = initialPreferences.find((p) => p.category === cat.key);
      map.set(cat.key, {
        email: existing ? existing.email : true,
        push: existing ? existing.push : true,
      });
    }
    return map;
  });

  const handleToggle = (
    categoryKey: string,
    channel: "email" | "push",
    value: boolean,
  ) => {
    setPrefs((prev) => {
      const next = new Map(prev);
      const current = next.get(categoryKey) ?? { email: true, push: true };
      next.set(categoryKey, { ...current, [channel]: value });
      return next;
    });
  };

  const handleSaveCategory = (categoryKey: string) => {
    setStatusMessage(null);
    setError(null);
    const pref = prefs.get(categoryKey);
    if (!pref) return;

    startTransition(async () => {
      const res = await updateNotificationPreferences({
        category: categoryKey,
        emailEnabled: pref.email,
        pushEnabled: pref.push,
      });

      if (!res.ok) {
        setError(res.error.message || "Failed to save preference");
        return;
      }

      setStatusMessage("Preference saved successfully");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Notification Preferences
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Configure how you receive updates across campus activities, academic
          alerts, and announcements.
        </p>
      </div>

      {statusMessage && (
        <output
          aria-live="polite"
          className="block p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-sm text-emerald-200"
        >
          {statusMessage}
        </output>
      )}

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      <div className="space-y-4">
        {ALL_CATEGORIES.map((category) => {
          const pref = prefs.get(category.key) ?? { email: true, push: true };

          return (
            <div
              key={category.key}
              className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-white">
                      {category.label}
                    </h2>
                    <span className="text-[11px] font-medium text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
                      {category.defaultClass === "immediate"
                        ? "Immediate Delivery"
                        : "Daily Digest"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    {category.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveCategory(category.key)}
                  disabled={isPending}
                  className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Save</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800/80">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950/50 min-h-[44px] cursor-pointer hover:bg-zinc-800/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={pref.email}
                    onChange={(e) =>
                      handleToggle(category.key, "email", e.target.checked)
                    }
                    className="rounded border-zinc-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <div className="flex items-center gap-2">
                    <Mail
                      className="w-4 h-4 text-zinc-400"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-medium text-zinc-200">
                      Email Delivery
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950/50 min-h-[44px] cursor-pointer hover:bg-zinc-800/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={pref.push}
                    onChange={(e) =>
                      handleToggle(category.key, "push", e.target.checked)
                    }
                    className="rounded border-zinc-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <div className="flex items-center gap-2">
                    <MessageSquare
                      className="w-4 h-4 text-zinc-400"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-medium text-zinc-200">
                      In-App / Push Notification
                    </span>
                  </div>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
