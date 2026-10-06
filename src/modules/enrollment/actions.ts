"use server";

import { z } from "zod";
import { defineAction } from "@/lib/actions/define-action";
import { AppError } from "@/lib/errors";
import { applyImport, dryRunImport, emailAllInvites } from "./import";
import { dropEnrollment, enrollStudent } from "./service";

export const enrollAction = defineAction({
  permission: "enrollment:create",
  input: z.object({
    sectionId: z.string().uuid(),
    studentId: z.string().optional(),
    reason: z.string().max(500).optional(),
  }),
  audit: {
    action: "enrollment:create",
    resourceType: "section",
    resourceId: (input) => input.sectionId,
  },
  handler: async (tx, actor, input) => {
    const isRegistrarOrAdmin =
      actor.roles.includes("super_admin") ||
      actor.roles.includes("admin") ||
      actor.roles.includes("registrar");

    const targetStudentId = input.studentId ?? actor.userId;

    if (targetStudentId !== actor.userId && !isRegistrarOrAdmin) {
      throw new AppError({
        code: "FORBIDDEN",
        message: "You can only enroll yourself in sections.",
      });
    }

    return await enrollStudent(tx, {
      sectionId: input.sectionId,
      studentId: targetStudentId,
      reason: input.reason,
      isRegistrarOrAdmin,
    });
  },
});

export const dropEnrollmentAction = defineAction({
  permission: "enrollment:delete",
  input: z.object({
    sectionId: z.string().uuid(),
    studentId: z.string().optional(),
    reason: z.string().max(500).optional(),
    override: z.boolean().optional(),
  }),
  audit: {
    action: "enrollment:drop",
    resourceType: "section",
    resourceId: (input) => input.sectionId,
  },
  handler: async (tx, actor, input) => {
    const isRegistrarOrAdmin =
      actor.roles.includes("super_admin") ||
      actor.roles.includes("admin") ||
      actor.roles.includes("registrar");

    const targetStudentId = input.studentId ?? actor.userId;

    if (targetStudentId !== actor.userId && !isRegistrarOrAdmin) {
      throw new AppError({
        code: "FORBIDDEN",
        message: "You can only drop your own enrollments.",
      });
    }

    return await dropEnrollment(tx, {
      sectionId: input.sectionId,
      studentId: targetStudentId,
      reason: input.reason,
      isRegistrarOrAdmin,
    });
  },
});

export const dryRunImportAction = defineAction({
  permission: "enrollment:create",
  input: z.object({
    csvContent: z.string().min(1),
  }),
  handler: async (tx, _actor, input) => {
    return await dryRunImport(input.csvContent, tx);
  },
});

export const applyImportAction = defineAction({
  permission: "enrollment:create",
  input: z.object({
    csvContent: z.string().min(1),
  }),
  audit: {
    action: "import:apply",
    resourceType: "import",
    resourceId: "batch-csv",
  },
  handler: async (tx, actor, input) => {
    return await applyImport(tx, input.csvContent, actor.userId);
  },
});

export const emailAllInvitesAction = defineAction({
  permission: "invitation:create",
  input: z.object({
    invites: z.array(
      z.object({
        userId: z.string(),
        inviteUrl: z.string(),
        name: z.string(),
      }),
    ),
  }),
  audit: {
    action: "invitations:email_all",
    resourceType: "invitation",
    resourceId: "batch-email",
  },
  handler: async (tx, _actor, input) => {
    return await emailAllInvites(tx, input.invites);
  },
});
