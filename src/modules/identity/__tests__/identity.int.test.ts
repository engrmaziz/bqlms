import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { sessionTable } from "@/db/schema";
import {
  acceptInvitation,
  createInvitation,
  createPasswordResetLink,
  createUserWithProfile,
  getInvitationByTokenHash,
  getProfileByUserId,
  hashToken,
  normalizeEmail,
  resetPasswordWithToken,
  setUserSuspendedStatus,
} from "@/modules/identity";

describe("Identity Module Integration Tests", () => {
  let adminUserId: string;

  beforeAll(async () => {
    const adminEmail = `admin_tester_${Date.now()}@college.edu`;
    const { user } = await createUserWithProfile({
      name: "Admin Tester",
      email: adminEmail,
      password: "SuperSecretAdmin123!",
      roles: ["super_admin", "admin"],
      status: "active",
    });
    adminUserId = user.id;
  });

  it("normalizes emails according to NFC and lowercase", () => {
    const raw = "  Student.TEST@College.EDU  ";
    expect(normalizeEmail(raw)).toBe("student.test@college.edu");
  });

  it("creates and accepts an invitation successfully", async () => {
    const testEmail = `invite_${Date.now()}@college.edu`;

    // 1. Create invitation
    const { invitation, inviteToken, inviteUrl } = await createInvitation({
      email: testEmail,
      roles: ["student"],
      createdBy: adminUserId,
    });

    expect(invitation.email).toBe(testEmail);
    expect(invitation.roles).toEqual(["student"]);
    expect(invitation.acceptedAt).toBeNull();
    expect(inviteUrl).toBe(`/accept-invite/${inviteToken}`);

    // Verify token hash is stored, not raw token
    const tokenHash = hashToken(inviteToken);
    expect(invitation.tokenHash).toBe(tokenHash);

    const queried = await getInvitationByTokenHash(tokenHash);
    expect(queried?.id).toBe(invitation.id);

    // 2. Accept invitation
    const { user, profile } = await acceptInvitation({
      token: inviteToken,
      name: "Invited Student",
      password: "StrongPassword123!",
    });

    expect(user.email).toBe(testEmail);
    expect(user.name).toBe("Invited Student");
    expect(profile.userId).toBe(user.id);
    expect(profile.roles).toEqual(["student"]);
    expect(profile.status).toBe("active");

    // 3. Re-using the invitation token must fail (single use)
    await expect(
      acceptInvitation({
        token: inviteToken,
        name: "Second Attempt",
        password: "StrongPassword123!",
      }),
    ).rejects.toThrow(/already been accepted/);
  });

  it("fails to accept an expired invitation", async () => {
    const testEmail = `expired_${Date.now()}@college.edu`;

    const { inviteToken } = await createInvitation({
      email: testEmail,
      roles: ["faculty"],
      createdBy: adminUserId,
      expiresInDays: -1, // Expired yesterday
    });

    await expect(
      acceptInvitation({
        token: inviteToken,
        name: "Late Acceptor",
        password: "Password123!",
      }),
    ).rejects.toThrow(/expired/);
  });

  it("creates an admin password reset link and allows one-time reset", async () => {
    const testEmail = `reset_user_${Date.now()}@college.edu`;
    const { user } = await createUserWithProfile({
      name: "Reset Target",
      email: testEmail,
      password: "InitialPassword123!",
      roles: ["faculty"],
    });

    // Create an active session to test session revocation on password change
    const sessionId = uuidv7();
    const sessionToken = `session_${Date.now()}`;
    await db.insert(sessionTable).values({
      id: sessionId,
      token: sessionToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    });

    const activeSessionsBefore = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.userId, user.id));
    expect(activeSessionsBefore.length).toBeGreaterThan(0);

    // Create reset link
    const { link, resetToken } = await createPasswordResetLink({
      userId: user.id,
      createdBy: adminUserId,
      expiresInMinutes: 60,
    });

    expect(link.usedAt).toBeNull();

    // Perform password reset
    const res = await resetPasswordWithToken({
      token: resetToken,
      newPassword: "BrandNewPassword123!",
    });
    expect(res.success).toBe(true);

    // Sessions must be revoked on password change
    const activeSessionsAfter = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.userId, user.id));
    expect(activeSessionsAfter.length).toBe(0);

    // Re-using the reset token must fail (single use)
    await expect(
      resetPasswordWithToken({
        token: resetToken,
        newPassword: "AnotherPassword123!",
      }),
    ).rejects.toThrow(/already been used/);
  });

  it("fails to use an expired password reset link", async () => {
    const testEmail = `expired_reset_${Date.now()}@college.edu`;
    const { user } = await createUserWithProfile({
      name: "Expired Reset Target",
      email: testEmail,
      password: "Password123!",
      roles: ["student"],
    });

    const { resetToken } = await createPasswordResetLink({
      userId: user.id,
      createdBy: adminUserId,
      expiresInMinutes: -5, // Expired
    });

    await expect(
      resetPasswordWithToken({
        token: resetToken,
        newPassword: "NewPassword123!",
      }),
    ).rejects.toThrow(/expired/);
  });

  it("suspends a user and revokes active sessions", async () => {
    const testEmail = `suspend_${Date.now()}@college.edu`;
    const { user } = await createUserWithProfile({
      name: "To Suspend",
      email: testEmail,
      password: "Password123!",
      roles: ["student"],
    });

    // Create a dummy session
    const sessionId = uuidv7();
    await db.insert(sessionTable).values({
      id: sessionId,
      token: `sess_${Date.now()}`,
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // Suspend user
    const updatedProfile = await setUserSuspendedStatus(user.id, true);
    expect(updatedProfile.status).toBe("suspended");

    // Check sessions were revoked
    const sessions = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.userId, user.id));
    expect(sessions.length).toBe(0);

    // Reactivate user
    const reactivatedProfile = await setUserSuspendedStatus(user.id, false);
    expect(reactivatedProfile.status).toBe("active");
  });

  it("supports multiple roles on a single user", async () => {
    const testEmail = `multi_role_${Date.now()}@college.edu`;
    const { user, profile } = await createUserWithProfile({
      name: "Dean and Instructor",
      email: testEmail,
      roles: ["faculty", "registrar"],
    });

    expect(profile.roles).toEqual(["faculty", "registrar"]);
    const loaded = await getProfileByUserId(user.id);
    expect(loaded?.roles).toEqual(["faculty", "registrar"]);
  });
});
