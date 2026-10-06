"use client";

import { AlertCircle, CheckCircle2, Save, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { Settings } from "@/modules/settings";
import { updateSettings } from "@/modules/settings/actions";

interface SettingsFormProps {
  initialSettings: Settings;
}

function getLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length !== 6) return 0;
  const r = Number.parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = Number.parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = Number.parseInt(cleanHex.substring(4, 6), 16) / 255;

  const [rs, gs, bs] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0);
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const router = useRouter();

  // Unique IDs for accessible labels and controls
  const collegeNameId = useId();
  const timezoneId = useId();
  const primaryColorPickerId = useId();
  const primaryColorInputId = useId();
  const accentColorPickerId = useId();
  const accentColorInputId = useId();
  const logoUrlId = useId();
  const mottoId = useId();
  const maxStudentsId = useId();
  const sessionTimeoutId = useId();

  const [collegeName, setCollegeName] = useState(initialSettings.collegeName);
  const [timezone, setTimezone] = useState(initialSettings.timezone);
  const [primaryColor, setPrimaryColor] = useState(
    initialSettings.branding.primaryColor || "#4f46e5",
  );
  const [accentColor, setAccentColor] = useState(
    initialSettings.branding.accentColor || "#06b6d4",
  );
  const [logoUrl, setLogoUrl] = useState(
    initialSettings.branding.logoUrl || "",
  );
  const [motto, setMotto] = useState(
    initialSettings.branding.institutionMotto || "",
  );

  const [allowSelfRegistration, setAllowSelfRegistration] = useState(
    Boolean(initialSettings.policies.allowSelfRegistration),
  );
  const [maxStudentsPerCourse, setMaxStudentsPerCourse] = useState(
    initialSettings.policies.maxStudentsPerCourse ?? 80,
  );
  const [enforceMfa, setEnforceMfa] = useState(
    Boolean(initialSettings.policies.enforceMfa),
  );
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(
    initialSettings.policies.sessionTimeoutMinutes ?? 60,
  );

  const [flags, setFlags] = useState<Record<string, boolean>>({
    aiAssistance: Boolean(initialSettings.flags.aiAssistance),
    emailNotifications: Boolean(initialSettings.flags.emailNotifications),
    maintenanceMode: Boolean(initialSettings.flags.maintenanceMode),
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // WCAG Contrast calculation
  const contrastVsWhite = /^#[0-9a-fA-F]{6}$/.test(primaryColor)
    ? getContrastRatio(primaryColor, "#ffffff")
    : 0;
  const contrastVsBlack = /^#[0-9a-fA-F]{6}$/.test(primaryColor)
    ? getContrastRatio(primaryColor, "#000000")
    : 0;
  const passesWcagAA = contrastVsWhite >= 4.5 || contrastVsBlack >= 4.5;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!passesWcagAA) {
      setError(
        "Brand primary color fails WCAG AA contrast guidelines (minimum 4.5:1 ratio against white or black required).",
      );
      return;
    }

    startTransition(async () => {
      const res = await updateSettings({
        collegeName: collegeName.trim(),
        timezone: timezone.trim(),
        branding: {
          primaryColor,
          accentColor,
          logoUrl: logoUrl.trim() ? logoUrl.trim() : null,
          institutionMotto: motto.trim(),
        },
        policies: {
          allowSelfRegistration,
          maxStudentsPerCourse: Number(maxStudentsPerCourse),
          enforceMfa,
          sessionTimeoutMinutes: Number(sessionTimeoutMinutes),
        },
        flags,
      });

      if (!res.ok) {
        setError(res.error.message);
        return;
      }

      setSuccess("College settings saved successfully.");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-sm text-red-200 flex items-start gap-2.5"
        >
          <AlertCircle
            className="w-5 h-5 text-red-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-sm text-emerald-200 flex items-start gap-2.5">
          <CheckCircle2
            className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{success}</span>
        </div>
      )}

      {/* General Settings */}
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            General Information
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Core institutional metadata displayed throughout the application.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor={collegeNameId}
              className="block text-xs font-medium text-zinc-300 mb-1.5"
            >
              Institution Name
            </label>
            <input
              id={collegeNameId}
              type="text"
              required
              value={collegeName}
              onChange={(e) => setCollegeName(e.target.value)}
              className="w-full px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor={timezoneId}
              className="block text-xs font-medium text-zinc-300 mb-1.5"
            >
              Institution Timezone
            </label>
            <select
              id={timezoneId}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="America/New_York">
                Eastern Time (US &amp; Canada)
              </option>
              <option value="America/Chicago">
                Central Time (US &amp; Canada)
              </option>
              <option value="America/Denver">
                Mountain Time (US &amp; Canada)
              </option>
              <option value="America/Los_Angeles">
                Pacific Time (US &amp; Canada)
              </option>
              <option value="Europe/London">London (GMT / BST)</option>
              <option value="Asia/Karachi">
                Islamabad, Karachi (PKT UTC+5)
              </option>
              <option value="Asia/Dubai">Dubai (GST UTC+4)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Branding & WCAG AA Contrast */}
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Visual Branding</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Colors and logo. Brand colors must satisfy WCAG AA contrast
            standards (&ge; 4.5:1 ratio against white or black).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor={primaryColorInputId}
              className="block text-xs font-medium text-zinc-300 mb-1.5"
            >
              Primary Brand Color (Hex)
            </label>
            <div className="flex gap-2">
              <input
                id={primaryColorPickerId}
                aria-label="Pick primary brand color"
                type="color"
                value={
                  /^#[0-9a-fA-F]{6}$/.test(primaryColor)
                    ? primaryColor
                    : "#4f46e5"
                }
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-11 h-11 min-h-[44px] min-w-[44px] p-1 bg-zinc-950 border border-zinc-800 rounded-xl cursor-pointer"
              />
              <input
                id={primaryColorInputId}
                type="text"
                required
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#4f46e5"
                className="flex-1 px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Live WCAG AA Contrast Badge */}
            <div className="mt-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">WCAG AA Contrast:</span>
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    passesWcagAA ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {passesWcagAA ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Passes (&ge; 4.5:1)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Fails (&lt; 4.5:1)</span>
                    </>
                  )}
                </span>
              </div>
              <div className="text-[11px] text-zinc-400 flex justify-between">
                <span>vs White: {contrastVsWhite.toFixed(2)}:1</span>
                <span>vs Black: {contrastVsBlack.toFixed(2)}:1</span>
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor={accentColorInputId}
              className="block text-xs font-medium text-zinc-300 mb-1.5"
            >
              Accent Color (Hex)
            </label>
            <div className="flex gap-2">
              <input
                id={accentColorPickerId}
                aria-label="Pick accent color"
                type="color"
                value={
                  /^#[0-9a-fA-F]{6}$/.test(accentColor)
                    ? accentColor
                    : "#06b6d4"
                }
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-11 h-11 min-h-[44px] min-w-[44px] p-1 bg-zinc-950 border border-zinc-800 rounded-xl cursor-pointer"
              />
              <input
                id={accentColorInputId}
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#06b6d4"
                className="flex-1 px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor={logoUrlId}
              className="block text-xs font-medium text-zinc-300 mb-1.5"
            >
              Logo URL (Optional)
            </label>
            <input
              id={logoUrlId}
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.edu/logo.png"
              className="w-full px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor={mottoId}
              className="block text-xs font-medium text-zinc-300 mb-1.5"
            >
              Institution Motto / Tagline
            </label>
            <input
              id={mottoId}
              type="text"
              value={motto}
              onChange={(e) => setMotto(e.target.value)}
              placeholder="Excellence in Education"
              className="w-full px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Academic & Security Policies */}
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Policies &amp; Limits
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Institutional guardrails and security thresholds.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor={maxStudentsId}
              className="block text-xs font-medium text-zinc-300 mb-1.5"
            >
              Max Students Per Course Section
            </label>
            <input
              id={maxStudentsId}
              type="number"
              min="1"
              max="500"
              value={maxStudentsPerCourse}
              onChange={(e) =>
                setMaxStudentsPerCourse(Number(e.target.value) || 1)
              }
              className="w-full px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor={sessionTimeoutId}
              className="block text-xs font-medium text-zinc-300 mb-1.5"
            >
              Session Timeout (Minutes)
            </label>
            <input
              id={sessionTimeoutId}
              type="number"
              min="15"
              max="1440"
              value={sessionTimeoutMinutes}
              onChange={(e) =>
                setSessionTimeoutMinutes(Number(e.target.value) || 15)
              }
              className="w-full px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <label className="flex items-center gap-3 p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60 min-h-[44px] cursor-pointer hover:bg-zinc-800 transition-colors">
            <input
              type="checkbox"
              checked={enforceMfa}
              onChange={(e) => setEnforceMfa(e.target.checked)}
              className="rounded border-zinc-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <div>
              <span className="text-sm font-medium text-white">
                Enforce MFA
              </span>
              <span className="block text-[11px] text-zinc-400">
                Mandatory 2FA for administrative staff
              </span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60 min-h-[44px] cursor-pointer hover:bg-zinc-800 transition-colors">
            <input
              type="checkbox"
              checked={allowSelfRegistration}
              onChange={(e) => setAllowSelfRegistration(e.target.checked)}
              className="rounded border-zinc-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <div>
              <span className="text-sm font-medium text-white">
                Self-Registration
              </span>
              <span className="block text-[11px] text-zinc-400">
                Allow student account self-creation
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Feature Flags</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Enable or disable campus services dynamically.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(flags).map(([key, enabled]) => (
            <label
              key={key}
              className={`flex items-center gap-3 p-3.5 rounded-xl border min-h-[44px] cursor-pointer transition-colors ${
                enabled
                  ? "border-indigo-600 bg-indigo-950/20 text-white"
                  : "border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800 text-zinc-300"
              }`}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) =>
                  setFlags({ ...flags, [key]: e.target.checked })
                }
                className="rounded border-zinc-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <span className="text-xs font-mono font-medium">{key}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isPending || !passesWcagAA}
          className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98]"
        >
          <Save className="w-4 h-4" aria-hidden="true" />
          <span>{isPending ? "Saving Settings..." : "Save Settings"}</span>
        </button>
      </div>
    </form>
  );
}
