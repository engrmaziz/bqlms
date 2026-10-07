import type { Actor } from "@/lib/auth/session";
import { can } from "@/lib/authz/can";

export interface ContentPolicyContext {
  sectionId: string;
  isInstructor?: boolean;
}

/**
 * Checks whether an actor has authority to author or edit content for a section.
 */
export async function canManageSectionContent(
  actor: Actor,
  sectionId: string,
): Promise<boolean> {
  return can(actor, "section:update", { sectionId });
}

/**
 * Checks whether an actor can publish content or syllabus versions.
 */
export async function canPublishSectionContent(
  actor: Actor,
  sectionId: string,
): Promise<boolean> {
  return can(actor, "section:update", { sectionId });
}

/**
 * Checks whether an actor has general read access to a section (instructors, enrolled students, admins).
 */
export async function canViewSectionContent(
  actor: Actor,
  sectionId: string,
): Promise<boolean> {
  return can(actor, "course:read", { sectionId });
}
