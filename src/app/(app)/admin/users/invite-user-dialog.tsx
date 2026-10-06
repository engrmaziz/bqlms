"use client";

import { AlertCircle, CheckCircle2, UserPlus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { CopyLinkButton } from "@/components/app/copy-link";
import type { Role } from "@/modules/identity";
import { inviteUser } from "@/modules/identity/actions";

interface InviteUserModalProps {
  currentUserRoles: Role[];
  onSuccess?: () => void;
}

const AVAILABLE_ROLES: { role: Role; label: string; privileged?: boolean }[] = [
  { role: "student", label: "Student" },
  { role: "faculty", label: "Faculty" },
  { role: "registrar", label: "Registrar" },
  { role: "admin", label: "Administrator", privileged: true },
  { role: "super_admin", label: "Super Administrator", privileged: true },
];

export function InviteUserModal({ currentUserRoles }: InviteUserModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(["student"]);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isSuperAdmin = currentUserRoles.includes("super_admin");

  const handleRoleToggle = (role: Role) => {
    if (selectedRoles.includes(role)) {
      if (selectedRoles.length > 1) {
        setSelectedRoles(selectedRoles.filter((r) => r !== role));
      }
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreatedUrl(null);

    startTransition(async () => {
      const res = await inviteUser({
        email: email.trim(),
        roles: selectedRoles,
      });

      if (!res.ok) {
        setError(res.error.message);
        return;
      }

      setCreatedUrl(res.value.inviteUrl);
      setEmail("");
      setSelectedRoles(["student"]);
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setError(null);
          setCreatedUrl(null);
        }}
        className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98]"
      >
        <UserPlus className="w-4 h-4" aria-hidden="true" />
        <span>Invite User</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h2
                id="invite-modal-title"
                className="text-lg font-semibold text-white"
              >
                Invite New User
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close dialog"
                className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {createdUrl ? (
              <div className="mt-6 space-y-4">
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-start gap-3">
                  <CheckCircle2
                    className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-200">
                      Invitation Created Successfully
                    </h3>
                    <p className="text-xs text-emerald-400/90 mt-1">
                      Share this one-time onboarding link with the invitee. The
                      link expires in 7 days.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between gap-3 overflow-hidden">
                  <span className="text-xs font-mono text-zinc-300 truncate">
                    {typeof window !== "undefined"
                      ? `${window.location.origin}${createdUrl}`
                      : createdUrl}
                  </span>
                  <CopyLinkButton
                    url={
                      typeof window !== "undefined"
                        ? `${window.location.origin}${createdUrl}`
                        : createdUrl
                    }
                    label="Copy"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedUrl(null);
                      setIsOpen(false);
                    }}
                    className="px-4 py-2.5 min-h-[44px] rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-medium text-white transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                {error && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-sm text-red-200 flex items-start gap-2"
                  >
                    <AlertCircle
                      className="w-4 h-4 text-red-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="invite-email"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    Email Address
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@college.edu"
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <span className="block text-xs font-medium text-zinc-300 mb-2">
                    Assign Roles
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {AVAILABLE_ROLES.map(({ role, label, privileged }) => {
                      const disabled = privileged && !isSuperAdmin;
                      const checked = selectedRoles.includes(role);

                      return (
                        <label
                          key={role}
                          className={`flex items-center gap-2.5 p-3 rounded-xl border min-h-[44px] cursor-pointer transition-colors ${
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
                          <span className="text-xs font-medium">
                            {label}
                            {privileged && (
                              <span className="ml-1 text-[10px] text-zinc-400">
                                (Super Admin only)
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2.5 min-h-[44px] rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-medium text-zinc-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || !email.trim()}
                    className="px-5 py-2.5 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium text-white transition-colors flex items-center gap-2"
                  >
                    {isPending ? "Inviting..." : "Create Invitation"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
