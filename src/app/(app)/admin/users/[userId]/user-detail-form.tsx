"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CopyLinkButton } from "@/components/app/copy-link";
import { formatDate } from "@/lib/datetime";
import type { Role, UserWithProfile } from "@/modules/identity";
import {
  generatePasswordResetLink,
  setUserSuspended,
  updateUserRoles,
} from "@/modules/identity/actions";

interface UserDetailProps {
  user: UserWithProfile;
  currentUserId: string;
  currentUserRoles: Role[];
}

const AVAILABLE_ROLES: { role: Role; label: string; privileged?: boolean }[] = [
  { role: "student", label: "Student" },
  { role: "faculty", label: "Faculty" },
  { role: "registrar", label: "Registrar" },
  { role: "admin", label: "Administrator", privileged: true },
  { role: "super_admin", label: "Super Administrator", privileged: true },
];

export function UserDetailForm({
  user,
  currentUserId,
  currentUserRoles,
}: UserDetailProps) {
  const router = useRouter();
  const isSuperAdmin = currentUserRoles.includes("super_admin");
  const isSelf = user.id === currentUserId;

  const [selectedRoles, setSelectedRoles] = useState<Role[]>(user.roles);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRoleToggle = (role: Role) => {
    if (selectedRoles.includes(role)) {
      if (selectedRoles.length > 1) {
        setSelectedRoles(selectedRoles.filter((r) => r !== role));
      }
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleSaveRoles = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await updateUserRoles({
        userId: user.id,
        roles: selectedRoles,
      });

      if (!res.ok) {
        setError(res.error.message);
        return;
      }

      setSuccess("User roles updated successfully.");
      router.refresh();
    });
  };

  const handleToggleSuspend = () => {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await setUserSuspended({
        userId: user.id,
        suspended: user.status !== "suspended",
      });

      if (!res.ok) {
        setError(res.error.message);
        return;
      }

      setSuccess(
        `Account ${res.value.status === "suspended" ? "suspended" : "reactivated"} successfully.`,
      );
      router.refresh();
    });
  };

  const handleGenerateReset = () => {
    setError(null);
    setResetUrl(null);

    startTransition(async () => {
      const res = await generatePasswordResetLink({ userId: user.id });

      if (!res.ok) {
        setError(res.error.message);
        return;
      }

      setResetUrl(res.value.resetUrl);
    });
  };

  const isSuspended = user.status === "suspended";

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/admin/users"
        prefetch={false}
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>Back to User Directory</span>
      </Link>

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

      {resetUrl && (
        <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-indigo-300">
              One-Time Password Reset Link (Valid for 60 Minutes)
            </span>
            <button
              type="button"
              onClick={() => setResetUrl(null)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-zinc-950 rounded-lg border border-zinc-800">
            <span className="text-xs font-mono text-zinc-300 truncate">
              {typeof window !== "undefined"
                ? `${window.location.origin}${resetUrl}`
                : resetUrl}
            </span>
            <CopyLinkButton
              url={
                typeof window !== "undefined"
                  ? `${window.location.origin}${resetUrl}`
                  : resetUrl
              }
              label="Copy Reset Link"
            />
          </div>
        </div>
      )}

      {/* User Information Card */}
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">{user.name}</h2>
          <p className="text-sm text-zinc-400 mt-1">{user.email}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-800 text-sm">
          <div>
            <span className="text-xs text-zinc-400 font-medium">
              Account Status
            </span>
            <div className="mt-1">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                  isSuspended
                    ? "bg-red-950/60 text-red-400 border border-red-800/60"
                    : "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSuspended ? "bg-red-400" : "bg-emerald-400"
                  }`}
                />
                {isSuspended ? "Suspended" : "Active"}
              </span>
            </div>
          </div>

          <div>
            <span className="text-xs text-zinc-400 font-medium">
              Joined Date
            </span>
            <p className="text-zinc-200 mt-1">{formatDate(user.createdAt)}</p>
          </div>

          <div>
            <span className="text-xs text-zinc-400 font-medium">
              Student / Employee ID
            </span>
            <p className="text-zinc-200 mt-1">
              {user.studentNumber || user.employeeId || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Role Assignment Card */}
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            Role Assignments
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Specify the institutional roles held by this account. Only Super
            Administrators may assign Admin or Super Admin privileges.
          </p>
        </div>

        <form onSubmit={handleSaveRoles} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {AVAILABLE_ROLES.map(({ role, label, privileged }) => {
              const disabled = privileged && !isSuperAdmin;
              const checked = selectedRoles.includes(role);

              return (
                <label
                  key={role}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border min-h-[44px] cursor-pointer transition-colors ${
                    disabled
                      ? "opacity-50 cursor-not-allowed border-zinc-800 bg-zinc-950/40"
                      : checked
                        ? "border-indigo-600 bg-indigo-950/20 text-white"
                        : "border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800 text-zinc-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => handleRoleToggle(role)}
                    className="rounded border-zinc-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-sm font-medium">{label}</span>
                    {privileged && (
                      <span className="block text-[11px] text-zinc-400">
                        Requires Super Admin
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium text-white transition-colors"
            >
              {isPending ? "Saving..." : "Update Roles"}
            </button>
          </div>
        </form>
      </div>

      {/* Security & Access Management Card */}
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            Security &amp; Account Actions
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Generate one-time credentials or modify active access credentials.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={handleGenerateReset}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-medium text-white border border-zinc-700 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <KeyRound className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <span>Generate Password Reset Link</span>
          </button>

          {!isSelf && (
            <button
              type="button"
              onClick={handleToggleSuspend}
              disabled={isPending}
              className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isSuspended
                  ? "bg-emerald-950/20 border-emerald-800 text-emerald-400 hover:bg-emerald-900/40"
                  : "bg-red-950/20 border-red-800 text-red-400 hover:bg-red-900/40"
              }`}
            >
              {isSuspended ? (
                <>
                  <UserCheck className="w-4 h-4" aria-hidden="true" />
                  <span>Reactivate Account</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                  <span>Suspend Account</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
