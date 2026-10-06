import crypto from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { db } from "@/db/client";
import { type Tx, withTx } from "@/db/tx";
import { AppError } from "@/lib/errors";
import {
  getInvitationByTokenHash,
  getPasswordResetLinkByTokenHash,
  getUserByEmail,
} from "./queries";
import {
  accountTable,
  type Invitation,
  invitationsTable,
  type PasswordResetLink,
  type Profile,
  passwordResetLinksTable,
  profilesTable,
  type Role,
  sessionTable,
  type User,
  userTable,
} from "./schema";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase().normalize("NFC");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface CreateInvitationInput {
  email: string;
  roles: Role[];
  createdBy: string;
  expiresInDays?: number;
}

export async function createInvitation(
  input: CreateInvitationInput,
  tx?: Tx,
): Promise<{ invitation: Invitation; inviteToken: string; inviteUrl: string }> {
  const normalized = normalizeEmail(input.email);
  const inviteToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(inviteToken);
  const days = input.expiresInDays ?? 14;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const executor = tx ?? db;
  const [invitation] = await executor
    .insert(invitationsTable)
    .values({
      email: normalized,
      roles: input.roles,
      tokenHash,
      expiresAt,
      createdBy: input.createdBy,
    })
    .returning();

  if (!invitation) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to create invitation record.",
    });
  }

  const inviteUrl = `/accept-invite/${inviteToken}`;
  return { invitation, inviteToken, inviteUrl };
}

export interface AcceptInvitationInput {
  token: string;
  name: string;
  password: string;
}

export async function acceptInvitation(
  input: AcceptInvitationInput,
  tx?: Tx,
): Promise<{ user: User; profile: Profile }> {
  const tokenHash = hashToken(input.token);

  return withTx(async (t) => {
    const invitation = await getInvitationByTokenHash(tokenHash, t);
    if (!invitation) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Invalid or expired invitation token.",
      });
    }

    if (invitation.acceptedAt !== null) {
      throw new AppError({
        code: "CONFLICT",
        message: "This invitation has already been accepted.",
      });
    }

    if (invitation.expiresAt < new Date()) {
      throw new AppError({
        code: "PRECONDITION_FAILED",
        message: "This invitation has expired.",
      });
    }

    // Check if user already exists
    const existing = await getUserByEmail(invitation.email, t);
    if (existing) {
      throw new AppError({
        code: "CONFLICT",
        message: "An account with this email already exists.",
      });
    }

    const userId = uuidv7();
    const hashedPassword = await hashPassword(input.password);
    const now = new Date();

    // 1. Create user in userTable
    const [user] = await t
      .insert(userTable)
      .values({
        id: userId,
        name: input.name.trim(),
        email: invitation.email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!user) {
      throw new AppError({
        code: "INTERNAL",
        message: "Failed to create user.",
      });
    }

    // 2. Create credential account in accountTable
    await t.insert(accountTable).values({
      id: uuidv7(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    });

    // 3. Create profile in profilesTable
    const [profile] = await t
      .insert(profilesTable)
      .values({
        userId,
        roles: invitation.roles,
        status: "active",
        createdAt: now,
      })
      .returning();

    if (!profile) {
      throw new AppError({
        code: "INTERNAL",
        message: "Failed to create profile.",
      });
    }

    // 4. Mark invitation accepted
    await t
      .update(invitationsTable)
      .set({ acceptedAt: now })
      .where(eq(invitationsTable.id, invitation.id));

    return { user, profile };
  }, tx);
}

export interface CreatePasswordResetLinkInput {
  userId: string;
  createdBy?: string;
  source?: "admin" | "self";
  expiresInMinutes?: number;
}

export async function createPasswordResetLink(
  input: CreatePasswordResetLinkInput,
  tx?: Tx,
): Promise<{ link: PasswordResetLink; resetToken: string; resetUrl: string }> {
  const resetToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(resetToken);
  const minutes = input.expiresInMinutes ?? 60; // 1-hour expiry
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

  const createdBy = input.createdBy ?? input.userId;

  const executor = tx ?? db;
  const [link] = await executor
    .insert(passwordResetLinksTable)
    .values({
      userId: input.userId,
      tokenHash,
      expiresAt,
      source: input.source ?? "admin",
      createdBy,
    })
    .returning();

  if (!link) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to create password reset link.",
    });
  }

  const resetUrl = `/reset/${resetToken}`;
  return { link, resetToken, resetUrl };
}

export interface ResetPasswordWithTokenInput {
  token: string;
  newPassword: string;
}

export async function resetPasswordWithToken(
  input: ResetPasswordWithTokenInput,
  tx?: Tx,
): Promise<{ success: true }> {
  const tokenHash = hashToken(input.token);

  return withTx(async (t) => {
    const link = await getPasswordResetLinkByTokenHash(tokenHash, t);
    if (!link) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Invalid or expired password reset link.",
      });
    }

    if (link.usedAt !== null) {
      throw new AppError({
        code: "CONFLICT",
        message: "This password reset link has already been used.",
      });
    }

    if (link.expiresAt < new Date()) {
      throw new AppError({
        code: "PRECONDITION_FAILED",
        message: "This password reset link has expired.",
      });
    }

    const hashedPassword = await hashPassword(input.newPassword);
    const now = new Date();

    // 1. Update credential password in accountTable
    await t
      .update(accountTable)
      .set({
        password: hashedPassword,
        updatedAt: now,
      })
      .where(
        and(
          eq(accountTable.userId, link.userId),
          eq(accountTable.providerId, "credential"),
        ),
      );

    // 2. Revoke all active sessions for this user on password change
    await t.delete(sessionTable).where(eq(sessionTable.userId, link.userId));

    // 3. Mark reset link as used
    await t
      .update(passwordResetLinksTable)
      .set({ usedAt: now })
      .where(eq(passwordResetLinksTable.id, link.id));

    return { success: true };
  }, tx);
}

export async function setUserSuspendedStatus(
  userId: string,
  suspended: boolean,
  tx?: Tx,
): Promise<Profile> {
  return withTx(async (t) => {
    const status = suspended ? "suspended" : "active";
    const [profile] = await t
      .update(profilesTable)
      .set({
        status,
      })
      .where(eq(profilesTable.userId, userId))
      .returning();

    if (!profile) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "User profile not found.",
      });
    }

    if (suspended) {
      // Revoke all sessions on suspension
      await t.delete(sessionTable).where(eq(sessionTable.userId, userId));
    }

    return profile;
  }, tx);
}

export interface CreateUserInput {
  name: string;
  email: string;
  password?: string;
  roles: Role[];
  status?: "invited" | "active" | "suspended";
  studentNumber?: string;
  employeeId?: string;
  phone?: string;
}

export async function createUserWithProfile(
  input: CreateUserInput,
  tx?: Tx,
): Promise<{ user: User; profile: Profile }> {
  const normalized = normalizeEmail(input.email);

  return withTx(async (t) => {
    const existing = await getUserByEmail(normalized, t);
    if (existing) {
      throw new AppError({
        code: "CONFLICT",
        message: "A user with this email already exists.",
      });
    }

    const userId = uuidv7();
    const now = new Date();

    const [user] = await t
      .insert(userTable)
      .values({
        id: userId,
        name: input.name.trim(),
        email: normalized,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!user) {
      throw new AppError({
        code: "INTERNAL",
        message: "Failed to create user.",
      });
    }

    if (input.password) {
      const hashedPassword = await hashPassword(input.password);
      await t.insert(accountTable).values({
        id: uuidv7(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      });
    }

    const [profile] = await t
      .insert(profilesTable)
      .values({
        userId,
        roles: input.roles,
        status: input.status ?? "active",
        ...(input.studentNumber !== undefined
          ? { studentNumber: input.studentNumber }
          : {}),
        ...(input.employeeId !== undefined
          ? { employeeId: input.employeeId }
          : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        createdAt: now,
      })
      .returning();

    if (!profile) {
      throw new AppError({
        code: "INTERNAL",
        message: "Failed to create profile.",
      });
    }

    return { user, profile };
  }, tx);
}
