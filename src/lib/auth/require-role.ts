import "server-only";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/errors";
import type { Role } from "@/modules/identity";
import { type Actor, getActor } from "./session";

/**
 * Server Component / Layout guard for portal routes.
 * NOTE: Layout guards are UX only. Every mutation and data fetch
 * re-authorizes independently via can() / defineAction.
 */
export async function requireRole(
  allowedRoles: Role[],
  customHeaders?: Headers,
): Promise<Actor> {
  const actor = await getActor(customHeaders);
  if (!actor) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Authentication required.",
    });
  }

  const hasRole = actor.roles.some((r) => allowedRoles.includes(r));
  if (!hasRole) {
    notFound();
  }

  return actor;
}
