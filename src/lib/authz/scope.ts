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
