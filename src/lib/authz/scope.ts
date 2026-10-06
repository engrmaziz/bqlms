import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sectionInstructorsTable } from "@/modules/academics/schema";
import { enrollmentsTable } from "@/modules/enrollment/schema";

export const SCOPES = [
  "college-wide",
  "instructor-of-section",
  "enrolled-in-section",
  "self",
] as const;

export type Scope = (typeof SCOPES)[number];

export interface ResourceContext {
  id?: string;
  type?: string;
  userId?: string;
  ownerId?: string;
  sectionId?: string;
  courseId?: string;
  [key: string]: unknown;
}

export interface RelationshipLoaders {
  isInstructorOfSection?: (
    userId: string,
    sectionId: string,
  ) => Promise<boolean> | boolean;
  isEnrolledInSection?: (
    userId: string,
    sectionId: string,
  ) => Promise<boolean> | boolean;
  getResourceOwnerId?: (
    resourceType: string,
    resourceId: string,
  ) => Promise<string | null> | string | null;
}

/**
 * Real database-backed relationship loaders for resource authorization checks.
 */
export const defaultRelationshipLoaders: RelationshipLoaders = {
  isInstructorOfSection: async (userId: string, sectionId: string) => {
    try {
      const [row] = await db
        .select({ sectionId: sectionInstructorsTable.sectionId })
        .from(sectionInstructorsTable)
        .where(
          and(
            eq(sectionInstructorsTable.userId, userId),
            eq(sectionInstructorsTable.sectionId, sectionId),
          ),
        )
        .limit(1);
      return Boolean(row);
    } catch {
      return false;
    }
  },
  isEnrolledInSection: async (userId: string, sectionId: string) => {
    try {
      const [row] = await db
        .select({ id: enrollmentsTable.id })
        .from(enrollmentsTable)
        .where(
          and(
            eq(enrollmentsTable.studentId, userId),
            eq(enrollmentsTable.sectionId, sectionId),
            eq(enrollmentsTable.status, "enrolled"),
          ),
        )
        .limit(1);
      return Boolean(row);
    } catch {
      return false;
    }
  },
  getResourceOwnerId: async (resourceType: string, resourceId: string) => {
    try {
      if (resourceType === "enrollment") {
        const [row] = await db
          .select({ studentId: enrollmentsTable.studentId })
          .from(enrollmentsTable)
          .where(eq(enrollmentsTable.id, resourceId))
          .limit(1);
        return row?.studentId ?? null;
      }
      return null;
    } catch {
      return null;
    }
  },
};
