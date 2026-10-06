import { PageHeader } from "@/components/app/page-header";
import { getActor } from "@/lib/auth/session";
import { listInvitations, listUsersWithProfiles } from "@/modules/identity";
import { InvitationsList } from "./invitations-list";
import { InviteUserModal } from "./invite-user-dialog";
import { UsersTable } from "./users-table";

interface UsersPageProps {
  searchParams: Promise<{
    search?: string;
    tab?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
  const actor = await getActor();
  const params = await searchParams;
  const search = params.search;
  const activeTab = params.tab ?? "users";

  const users = await listUsersWithProfiles(search ? { search } : {});
  const invitations = await listInvitations();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="User Management"
          description="Manage institutional accounts, onboarding invitations, and role assignments."
        />
        {actor && (
          <div className="shrink-0">
            <InviteUserModal currentUserRoles={actor.roles} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 gap-4">
        <a
          href="?tab=users"
          className={`pb-3 text-sm font-medium border-b-2 transition-colors min-h-[44px] flex items-center ${
            activeTab === "users"
              ? "border-indigo-500 text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Active Accounts ({users.length})
        </a>
        <a
          href="?tab=invitations"
          className={`pb-3 text-sm font-medium border-b-2 transition-colors min-h-[44px] flex items-center ${
            activeTab === "invitations"
              ? "border-indigo-500 text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Pending Invitations ({invitations.filter((i) => !i.acceptedAt).length}
          )
        </a>
      </div>

      {activeTab === "users" ? (
        <div className="space-y-4">
          {/* Search Bar */}
          <form method="GET" className="flex gap-2 max-w-md">
            <input type="hidden" name="tab" value="users" />
            <input
              type="search"
              name="search"
              defaultValue={search ?? ""}
              placeholder="Search by name, email, or student ID..."
              aria-label="Search users"
              className="flex-1 px-3.5 py-2.5 min-h-[44px] bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-2.5 min-h-[44px] rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-medium text-white transition-colors"
            >
              Search
            </button>
          </form>

          {actor && (
            <UsersTable
              users={users}
              currentUserId={actor.userId}
              currentUserRoles={actor.roles}
            />
          )}
        </div>
      ) : (
        <InvitationsList invitations={invitations} />
      )}
    </div>
  );
}
