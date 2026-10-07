import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/require-role";

/**
 * NOTE: Layout guards are UX only. Every database query and server action
 * re-authorizes independently via can() / defineAction.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Requires one of the administration roles; unauthorized users get a 404
  await requireRole(["super_admin", "admin", "registrar"]);

  return <div className="admin-portal space-y-6">{children}</div>;
}
