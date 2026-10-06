import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/session";

/**
 * NOTE: Layout guards are UX only. Every database query and server action
 * re-authorizes independently via can() / defineAction.
 */
export default async function FacultyLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["faculty"]);

  return <div className="faculty-portal space-y-6">{children}</div>;
}
