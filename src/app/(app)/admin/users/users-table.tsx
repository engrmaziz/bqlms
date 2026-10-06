"use client";

import { AlertCircle, KeyRound, ShieldAlert, UserCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CopyLinkButton } from "@/components/app/copy-link";
import type { Role, UserWithProfile } from "@/modules/identity";
import {
  generatePasswordResetLink,
  setUserSuspended,
} from "@/modules/identity/actions";

interface UsersTableProps {
  users: UserWithProfile[];
  currentUserId: string;
  currentUserRoles: Role[];
}

const ROLE_BADGE_STYLES: Record<Role, string> = {
  super_admin: "bg-purple-900/40 text-purple-300 border-purple-700/50",
  admin: "bg-indigo-900/40 text-indigo-300 border-indigo-700/50",
  registrar: "bg-blue-900/40 text-blue-300 border-blue-700/50",
  faculty: "bg-emerald-900/40 text-emerald-300 border-emerald-700/50",
  student: "bg-zinc-800 text-zinc-300 border-zinc-700/50",
};

export function UsersTable({ users, currentUserId }: UsersTableProps) {
  const router = useRouter();
  const [activeResetUrl, setActiveResetUrl] = useState<{
    userId: string;
    url: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleGenerateReset = (userId: string) => {
    setActionError(null);
    setActiveResetUrl(null);

    startTransition(async () => {
      const res = await generatePasswordResetLink({ userId });
      if (!res.ok) {
        setActionError(res.error.message);
        return;
      }
      setActiveResetUrl({ userId, url: res.value.resetUrl });
    });
  };

  const handleToggleSuspend = (userId: string, currentSuspended: boolean) => {
    setActionError(null);

    startTransition(async () => {
      const res = await setUserSuspended({
        userId,
        suspended: !currentSuspended,
      });
      if (!res.ok) {
        setActionError(res.error.message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {actionError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-red-950/40 border border-red-800 text-sm text-red-200 flex items-start gap-2.5"
        >
          <AlertCircle
            className="w-4 h-4 text-red-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{actionError}</span>
        </div>
      )}

      {activeResetUrl && (
        <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-indigo-300">
              One-Time Password Reset Link Generated (Valid for 60 minutes)
            </p>
            <p className="text-xs font-mono text-zinc-300 truncate mt-1">
              {typeof window !== "undefined"
                ? `${window.location.origin}${activeResetUrl.url}`
                : activeResetUrl.url}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <CopyLinkButton
              url={
                typeof window !== "undefined"
                  ? `${window.location.origin}${activeResetUrl.url}`
                  : activeResetUrl.url
              }
              label="Copy Reset Link"
            />
            <button
              type="button"
              onClick={() => setActiveResetUrl(null)}
              className="px-3 py-2 text-xs text-zinc-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-medium">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3.5 font-semibold text-zinc-300"
                >
                  User
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 font-semibold text-zinc-300"
                >
                  Roles
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 font-semibold text-zinc-300"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 font-semibold text-zinc-300"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {users.length ? (
                users.map((u) => {
                  const isSelf = u.id === currentUserId;
                  const isSuspended = u.status === "suspended";

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-zinc-900/40 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <Link
                            href={`/admin/users/${u.id}`}
                            prefetch={false}
                            className="font-medium text-white hover:text-indigo-400 transition-colors inline-block focus-visible:outline-none focus-visible:underline"
                          >
                            {u.name}
                          </Link>
                          <span className="text-xs text-zinc-400 mt-0.5">
                            {u.email}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {u.roles.map((r) => (
                            <span
                              key={r}
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                                ROLE_BADGE_STYLES[r] ??
                                "bg-zinc-800 text-zinc-300"
                              }`}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
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
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/users/${u.id}`}
                            prefetch={false}
                            className="px-3 py-1.5 min-h-[44px] inline-flex items-center text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500"
                          >
                            Manage
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleGenerateReset(u.id)}
                            disabled={isPending}
                            title="Generate one-time password reset link"
                            aria-label={`Generate password reset link for ${u.name}`}
                            className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-zinc-400 hover:text-amber-400 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500"
                          >
                            <KeyRound className="w-4 h-4" aria-hidden="true" />
                          </button>

                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleSuspend(u.id, isSuspended)
                              }
                              disabled={isPending}
                              title={
                                isSuspended
                                  ? "Reactivate user account"
                                  : "Suspend user account"
                              }
                              aria-label={
                                isSuspended
                                  ? `Reactivate account for ${u.name}`
                                  : `Suspend account for ${u.name}`
                              }
                              className={`p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center border rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                isSuspended
                                  ? "text-emerald-400 bg-emerald-950/20 border-emerald-800/40 hover:bg-emerald-900/30"
                                  : "text-red-400 bg-red-950/20 border-red-800/40 hover:bg-red-900/30"
                              }`}
                            >
                              {isSuspended ? (
                                <UserCheck
                                  className="w-4 h-4"
                                  aria-hidden="true"
                                />
                              ) : (
                                <ShieldAlert
                                  className="w-4 h-4"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="h-28 text-center text-zinc-400 text-sm"
                  >
                    No matching users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
