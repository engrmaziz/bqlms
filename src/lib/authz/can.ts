import type { Actor } from "@/lib/auth/session";
import { type Permission, ROLE_PERMISSIONS } from "./permissions";
import type { RelationshipLoaders, ResourceContext } from "./scope";

/**
 * Checks whether an actor is authorized to perform an action on a resource.
 * Pure function: relies strictly on actor, permission, resource context, and provided loaders.
 */
export async function can(
  actor: Actor | null | undefined,
  permission: Permission,
  resource?: ResourceContext,
  loaders?: RelationshipLoaders,
): Promise<boolean> {
  if (!actor || actor.status !== "active") {
    return false;
  }

  // Iterate over all roles held by the actor
  for (const role of actor.roles) {
    const rolePermissions = ROLE_PERMISSIONS[role];
    if (!rolePermissions || !rolePermissions.includes(permission)) {
      continue;
    }

    // 1. College-wide scope roles
    if (role === "super_admin") {
      return true;
    }

    if (role === "admin" || role === "registrar") {
      // College-wide access for staff roles
      return true;
    }

    // 2. Self check (if resource has direct user ownership)
    const isSelf =
      Boolean(resource) &&
      (resource?.userId === actor.userId ||
        resource?.ownerId === actor.userId ||
        resource?.id === actor.userId);

    // 3. Faculty role scope checks
    if (role === "faculty") {
      if (resource?.sectionId) {
        if (loaders?.isInstructorOfSection) {
          const isInstructor = await loaders.isInstructorOfSection(
            actor.userId,
            resource.sectionId,
          );
          if (isInstructor) {
            return true;
          }
        }
        // If not instructor of this section, check if it's purely self resource
        if (isSelf) {
          return true;
        }
        continue;
      }

      if (isSelf || !resource) {
        return true;
      }
    }

    // 4. Student role scope checks
    if (role === "student") {
      if (resource?.sectionId) {
        if (loaders?.isEnrolledInSection) {
          const isEnrolled = await loaders.isEnrolledInSection(
            actor.userId,
            resource.sectionId,
          );
          if (isEnrolled) {
            // If resource has a user/owner constraint, student can only access their own
            const targetUser = resource.userId || resource.ownerId;
            if (targetUser && targetUser !== actor.userId) {
              continue;
            }
            return true;
          }
        }
        if (isSelf) {
          return true;
        }
        continue;
      }

      if (isSelf || !resource) {
        return true;
      }
    }
  }

  return false;
}
