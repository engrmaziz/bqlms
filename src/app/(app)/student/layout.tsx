import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/require-role";

/**
 * NOTE: Layout guards are UX only. Every database query and server action
 * re-authorizes independently via can() / defineAction.
 */
export default async function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["student"]);

  return <div className="student-portal space-y-6">{children}</div>;
}
