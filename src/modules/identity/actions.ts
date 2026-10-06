"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { defineAction } from "@/lib/actions/define-action";
import { AppError } from "@/lib/errors";
import {
  countActiveSuperAdmins,
  deleteInvitationById,
  getProfileByUserId,
} from "./queries";
import { profilesTable, roleEnum } from "./schema";
import {
  createInvitation,
  createPasswordResetLink,
  setUserSuspendedStatus,
} from "./service";

const roleValues = roleEnum.enumValues;

export const inviteUser = defineAction({
  permission: "invitation:create",
  rateLimit: { bucket: "write", limit: 30, windowSeconds: 60 },
  input: z.object({
    email: z.string().email(),
    roles: z.array(z.enum(roleValues)).min(1),
  }),
  handler: async (_tx, actor, input) => {
    // Only super_admin may grant admin or super_admin roles
    const grantingPrivileged =
      input.roles.includes("admin") || input.roles.includes("super_admin");
    if (grantingPrivileged && !actor.roles.includes("super_admin")) {
      throw new AppError({
        code: "FORBIDDEN",
        message:
          "Only super administrators can grant admin or super_admin roles.",
      });
    }

    const res = await createInvitation({
      email: input.email,
      roles: input.roles,
      createdBy: actor.userId,
    });

    return {
      invitation: res.invitation,
      inviteUrl: res.inviteUrl,
    };
  },
  audit: (_input, output) => ({
    action: "invitation.create",
    resourceType: "invitation",
    resourceId: output.invitation.id,
    after: output.invitation,
  }),
});

export const revokeInvitation = defineAction({
  permission: "invitation:revoke",
  rateLimit: { bucket: "write", limit: 30, windowSeconds: 60 },
  input: z.object({
    invitationId: z.string(),
  }),
  audit: (input) => ({
    action: "invitation.revoke",
    resourceType: "invitation",
    resourceId: input.invitationId,
  }),
  handler: async (tx, _actor, input) => {
    await deleteInvitationById(input.invitationId, tx);
    return { success: true };
  },
});

export const updateUserRoles = defineAction({
  permission: "user:update",
  rateLimit: { bucket: "write", limit: 30, windowSeconds: 60 },
  input: z.object({
    userId: z.string(),
    roles: z.array(z.enum(roleValues)).min(1),
  }),
  audit: (input) => ({
    action: "user.update_roles",
    resourceType: "user",
    resourceId: input.userId,
    after: { roles: input.roles },
  }),
  handler: async (tx, actor, input) => {
    const targetProfile = await getProfileByUserId(input.userId, tx);
    if (!targetProfile) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "User profile not found.",
      });
    }

    // Only super_admin may grant admin or super_admin
    const grantingPrivileged =
      input.roles.includes("admin") || input.roles.includes("super_admin");
    if (grantingPrivileged && !actor.roles.includes("super_admin")) {
      throw new AppError({
        code: "FORBIDDEN",
        message:
          "Only super administrators can grant admin or super_admin roles.",
      });
    }

    // Nobody can remove or demote the last super_admin
    const isTargetSuperAdmin = targetProfile.roles.includes("super_admin");
    const willBeSuperAdmin = input.roles.includes("super_admin");
    if (isTargetSuperAdmin && !willBeSuperAdmin) {
      const superAdminCount = await countActiveSuperAdmins(tx);
      if (superAdminCount <= 1) {
        throw new AppError({
          code: "PRECONDITION_FAILED",
          message:
            "Cannot remove or demote the last active Super Administrator.",
        });
      }
    }

    await tx
      .update(profilesTable)
      .set({ roles: input.roles })
      .where(eq(profilesTable.userId, input.userId));

    return { success: true, roles: input.roles };
  },
});

export const setUserSuspended = defineAction({
  permission: "user:suspend",
  rateLimit: { bucket: "write", limit: 30, windowSeconds: 60 },
  input: z.object({
    userId: z.string(),
    suspended: z.boolean(),
  }),
  audit: (input) => ({
    action: input.suspended ? "user.suspend" : "user.reactivate",
    resourceType: "user",
    resourceId: input.userId,
    after: { status: input.suspended ? "suspended" : "active" },
  }),
  handler: async (tx, _actor, input) => {
    const targetProfile = await getProfileByUserId(input.userId, tx);
    if (!targetProfile) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "User profile not found.",
      });
    }

    // The last super_admin cannot be suspended
    if (input.suspended && targetProfile.roles.includes("super_admin")) {
      const superAdminCount = await countActiveSuperAdmins(tx);
      if (superAdminCount <= 1) {
        throw new AppError({
          code: "PRECONDITION_FAILED",
          message: "Cannot suspend the last active Super Administrator.",
        });
      }
    }

    const updated = await setUserSuspendedStatus(
      input.userId,
      input.suspended,
      tx,
    );
    return { success: true, status: updated.status };
  },
});

export const generatePasswordResetLink = defineAction({
  permission: "user:reset_password",
  rateLimit: { bucket: "write", limit: 30, windowSeconds: 60 },
  input: z.object({
    userId: z.string(),
  }),
  audit: (input) => ({
    action: "user.generate_reset_link",
    resourceType: "user",
    resourceId: input.userId,
  }),
  handler: async (tx, actor, input) => {
    const targetProfile = await getProfileByUserId(input.userId, tx);
    if (!targetProfile) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "User profile not found.",
      });
    }

    const res = await createPasswordResetLink(
      {
        userId: input.userId,
        createdBy: actor.userId,
        expiresInMinutes: 60,
      },
      tx,
    );

    return { resetUrl: res.resetUrl };
  },
});
