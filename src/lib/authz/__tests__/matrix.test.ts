import { describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/session";
import { can } from "../can";
import {
  hasRolePermission,
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from "../permissions";
import type { RelationshipLoaders } from "../scope";

function makeActor(overrides: Partial<Actor> = {}): Actor {
  return {
    userId: "usr-test-1",
    email: "test@college.edu",
    name: "Test User",
    roles: ["student"],
    status: "active",
    twoFactorEnabled: false,
    profile: {
      userId: "usr-test-1",
      roles: ["student"],
      status: "active",
      studentNumber: "STU-001",
      employeeId: null,
      phone: null,
      createdAt: new Date(),
    },
    ...overrides,
  };
}

describe("Authorization Permissions & Role Matrix", () => {
  it("ensures every permission is assigned to super_admin", () => {
    for (const permission of PERMISSIONS) {
      expect(hasRolePermission(["super_admin"], permission)).toBe(true);
      expect(ROLE_PERMISSIONS.super_admin).toContain(permission);
    }
  });

  it("super_admin has college-wide scope for all permissions", async () => {
    const actor = makeActor({ roles: ["super_admin"] });
    expect(await can(actor, "settings:update")).toBe(true);
    expect(await can(actor, "user:delete")).toBe(true);
    expect(await can(actor, "assignment:grade")).toBe(true);
  });

  it("admin has college-wide scope for admin permissions but denied user:delete", async () => {
    const actor = makeActor({ roles: ["admin"] });
    expect(await can(actor, "course:create")).toBe(true);
    expect(await can(actor, "settings:update")).toBe(true);
    expect(await can(actor, "user:delete")).toBe(false);
  });

  it("registrar has college-wide scope for enrollment and courses, but cannot grade", async () => {
    const actor = makeActor({ roles: ["registrar"] });
    expect(await can(actor, "enrollment:create")).toBe(true);
    expect(await can(actor, "course:create")).toBe(true);
    expect(await can(actor, "grade:submit")).toBe(false);
  });

  it("faculty requires instructor-of-section relationship scope", async () => {
    const faculty = makeActor({ userId: "prof-1", roles: ["faculty"] });

    const loaders: RelationshipLoaders = {
      isInstructorOfSection: (userId, sectionId) =>
        userId === "prof-1" && sectionId === "sec-allowed",
    };

    // Allowed for section they teach
    expect(
      await can(
        faculty,
        "assignment:create",
        { sectionId: "sec-allowed" },
        loaders,
      ),
    ).toBe(true);

    // Denied for section they do not teach
    expect(
      await can(
        faculty,
        "assignment:create",
        { sectionId: "sec-other" },
        loaders,
      ),
    ).toBe(false);

    // Denied student actions
    expect(await can(faculty, "assignment:submit")).toBe(false);
  });

  it("student requires enrolled-in-section relationship scope and self ownership", async () => {
    const student = makeActor({ userId: "stu-1", roles: ["student"] });

    const loaders: RelationshipLoaders = {
      isEnrolledInSection: (userId, sectionId) =>
        userId === "stu-1" && sectionId === "sec-enrolled",
    };

    // Allowed submitting own assignment in enrolled section
    expect(
      await can(
        student,
        "assignment:submit",
        { sectionId: "sec-enrolled", userId: "stu-1" },
        loaders,
      ),
    ).toBe(true);

    // Denied submitting for another student
    expect(
      await can(
        student,
        "assignment:submit",
        { sectionId: "sec-enrolled", userId: "stu-other" },
        loaders,
      ),
    ).toBe(false);

    // Denied in section they are not enrolled in
    expect(
      await can(
        student,
        "assignment:submit",
        { sectionId: "sec-not-enrolled" },
        loaders,
      ),
    ).toBe(false);

    // Denied administrative actions
    expect(await can(student, "course:create")).toBe(false);
    expect(await can(student, "grade:publish")).toBe(false);
  });

  it("self scope allows acting on self-owned resources", async () => {
    const student = makeActor({ userId: "stu-me", roles: ["student"] });
    expect(await can(student, "upload:create", { userId: "stu-me" })).toBe(
      true,
    );
    expect(await can(student, "upload:create", { userId: "stu-other" })).toBe(
      false,
    );
  });

  it("rejects suspended actor unconditionally", async () => {
    const suspendedAdmin = makeActor({
      roles: ["super_admin"],
      status: "suspended",
    });
    expect(await can(suspendedAdmin, "settings:read")).toBe(false);
  });

  it("rejects null or unauthenticated actor unconditionally", async () => {
    expect(await can(null, "settings:read")).toBe(false);
    expect(await can(undefined, "settings:read")).toBe(false);
  });
});
