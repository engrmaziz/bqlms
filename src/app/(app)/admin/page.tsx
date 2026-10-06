import { Settings, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { getActor } from "@/lib/auth/session";
import { listInvitations, listUsersWithProfiles } from "@/modules/identity";
import { getSettings } from "@/modules/settings";

export default async function AdminDashboardPage() {
  const actor = await getActor();
  const settings = await getSettings();
  const users = await listUsersWithProfiles({ limit: 5 });
  const invitations = await listInvitations();

  const isSuperAdmin = actor?.roles.includes("super_admin");

  return (
    <div className="space-y-6">
      <PageHeader
        title={settings.collegeName}
        description="Institutional records, identity administration, and academic configurations."
      />

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Total Users</p>
            <p className="text-3xl font-bold text-white mt-1">{users.length}</p>
          </div>
          <div className="p-3 bg-indigo-600/10 text-indigo-400 rounded-xl">
            <Users className="w-6 h-6" aria-hidden="true" />
          </div>
        </div>

        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Pending Invites</p>
            <p className="text-3xl font-bold text-white mt-1">
              {invitations.length}
            </p>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <UserPlus className="w-6 h-6" aria-hidden="true" />
          </div>
        </div>

        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Timezone</p>
            <p className="text-xl font-bold text-white mt-1 truncate">
              {settings.timezone}
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Settings className="w-6 h-6" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Action Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <Link
          href="/admin/users"
          prefetch={false}
          className="p-6 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-2xl transition-all group flex flex-col justify-between"
        >
          <div>
            <h2 className="text-lg font-semibold text-white group-hover:text-indigo-400 transition-colors">
              User &amp; Invitation Management
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Invite students, faculty, and administrative staff. Manage roles,
              suspensions, and one-time password reset links.
            </p>
          </div>
          <span className="text-xs text-indigo-400 font-medium mt-4 flex items-center gap-1">
            Manage Users &rarr;
          </span>
        </Link>

        {isSuperAdmin && (
          <Link
            href="/admin/settings"
            prefetch={false}
            className="p-6 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-2xl transition-all group flex flex-col justify-between"
          >
            <div>
              <h2 className="text-lg font-semibold text-white group-hover:text-indigo-400 transition-colors">
                College Settings
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                Configure institution name, branding, WCAG contrast colors,
                timezone, and feature flags.
              </p>
            </div>
            <span className="text-xs text-indigo-400 font-medium mt-4 flex items-center gap-1">
              Configure Settings &rarr;
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
