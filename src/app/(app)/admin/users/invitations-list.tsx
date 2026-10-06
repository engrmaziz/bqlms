"use client";

import { AlertCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDate } from "@/lib/datetime";
import type { Invitation } from "@/modules/identity";
import { revokeInvitation } from "@/modules/identity/actions";

interface InvitationsListProps {
  invitations: Invitation[];
}

export function InvitationsList({ invitations }: InvitationsListProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRevoke = (invitationId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await revokeInvitation({ invitationId });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      router.refresh();
    });
  };

  const pendingInvitations = invitations.filter((i) => !i.acceptedAt);

  if (!pendingInvitations.length) {
    return (
      <div className="p-8 text-center border border-zinc-800 rounded-2xl bg-zinc-950/40 text-sm text-zinc-400">
        No pending invitations.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-red-950/40 border border-red-800 text-sm text-red-200 flex items-start gap-2.5"
        >
          <AlertCircle
            className="w-4 h-4 text-red-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{error}</span>
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
                  Recipient Email
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 font-semibold text-zinc-300"
                >
                  Invited Roles
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 font-semibold text-zinc-300"
                >
                  Expires
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
              {pendingInvitations.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-zinc-900/40 transition-colors"
                >
                  <td className="px-4 py-3.5 font-medium text-white">
                    {inv.email}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {inv.roles.map((r) => (
                        <span
                          key={r}
                          className="text-[11px] font-medium px-2 py-0.5 rounded-md border bg-zinc-800 text-zinc-300 border-zinc-700/50"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-zinc-400">
                    {formatDate(inv.expiresAt)}
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => handleRevoke(inv.id)}
                      disabled={isPending}
                      aria-label={`Revoke invitation for ${inv.email}`}
                      className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-red-400 hover:text-red-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
