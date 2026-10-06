import type { Role } from "@/modules/identity/schema";

export const PERMISSIONS = [
  // Settings
  "settings:read",
  "settings:update",

  // Users & Profiles
  "user:create",
  "user:read",
  "user:update",
  "user:delete",
  "user:suspend",
  "user:reset_password",

  // Invitations
  "invitation:create",
  "invitation:read",
  "invitation:revoke",

  // Courses
  "course:create",
  "course:read",
  "course:update",
  "course:delete",

  // Sections
  "section:create",
  "section:read",
  "section:update",
  "section:delete",

  // Enrollments
  "enrollment:create",
  "enrollment:read",
  "enrollment:update",
  "enrollment:delete",

  // Grades
  "grade:read",
  "grade:submit",
  "grade:publish",

  // Assignments
  "assignment:create",
  "assignment:read",
  "assignment:update",
  "assignment:delete",
  "assignment:submit",
  "assignment:grade",

  // Attendance
  "attendance:read",
  "attendance:record",

  // Audit Logs
  "audit:read",

  // Files & Uploads
  "upload:create",
  "upload:read",

  // Messages & Announcements
  "message:create",
  "message:read",

  // Reports
  "report:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  admin: [
    "settings:read",
    "settings:update",
    "user:create",
    "user:read",
    "user:update",
    "user:suspend",
    "user:reset_password",
    "invitation:create",
    "invitation:read",
    "invitation:revoke",
    "course:create",
    "course:read",
    "course:update",
    "course:delete",
    "section:create",
    "section:read",
    "section:update",
    "section:delete",
    "enrollment:create",
    "enrollment:read",
    "enrollment:update",
    "enrollment:delete",
    "grade:read",
    "grade:publish",
    "assignment:create",
    "assignment:read",
    "assignment:update",
    "assignment:delete",
    "attendance:read",
    "audit:read",
    "upload:create",
    "upload:read",
    "message:create",
    "message:read",
    "report:read",
  ],
  registrar: [
    "settings:read",
    "user:read",
    "user:create",
    "user:update",
    "invitation:create",
    "invitation:read",
    "course:read",
    "course:create",
    "course:update",
    "section:read",
    "section:create",
    "section:update",
    "enrollment:create",
    "enrollment:read",
    "enrollment:update",
    "enrollment:delete",
    "grade:read",
    "grade:publish",
    "attendance:read",
    "upload:read",
    "message:read",
    "report:read",
  ],
  faculty: [
    "settings:read",
    "user:read",
    "course:read",
    "section:read",
    "enrollment:read",
    "assignment:create",
    "assignment:read",
    "assignment:update",
    "assignment:delete",
    "assignment:grade",
    "grade:read",
    "grade:submit",
    "attendance:read",
    "attendance:record",
    "upload:create",
    "upload:read",
    "message:create",
    "message:read",
  ],
  student: [
    "settings:read",
    "course:read",
    "section:read",
    "enrollment:read",
    "assignment:read",
    "assignment:submit",
    "grade:read",
    "attendance:read",
    "upload:create",
    "upload:read",
    "message:read",
  ],
};

export function hasRolePermission(
  roles: readonly Role[],
  permission: Permission,
): boolean {
  for (const role of roles) {
    const list = ROLE_PERMISSIONS[role];
    if (list?.includes(permission)) {
      return true;
    }
  }
  return false;
}
