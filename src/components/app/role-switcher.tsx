"use client";

import { useRouter } from "next/navigation";
import { getPortalForRole } from "@/lib/nav";
import type { Role } from "@/modules/identity/schema";

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  registrar: "Registrar",
  faculty: "Faculty",
  student: "Student",
};

export function RoleSwitcher({
  roles,
  activeRole,
}: {
  roles: Role[];
  activeRole: Role;
}) {
  const router = useRouter();

  if (roles.length <= 1) {
    return null;
  }

  const handleRoleChange = (newRole: Role) => {
    // Set cookie valid for 30 days
    // biome-ignore lint/suspicious/noDocumentCookie: Active role cookie set client-side for UX portal switching
    document.cookie = `bqlms_active_role=${newRole}; path=/; max-age=2592000; SameSite=Lax`;
    const targetPortal = getPortalForRole(newRole);
    router.push(`/${targetPortal}`);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-1.5 p-2 bg-zinc-900 border border-zinc-800 rounded-xl">
      <label
        htmlFor="role-switcher-select"
        className="text-xs font-medium text-zinc-400"
      >
        Active Role
      </label>
      <select
        id="role-switcher-select"
        data-testid="role-switcher-select"
        aria-label="Switch active role"
        value={activeRole}
        onChange={(e) => handleRoleChange(e.target.value as Role)}
        className="w-full min-h-[44px] px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900 cursor-pointer"
      >
        {roles.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
    </div>
  );
}
