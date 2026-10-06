"use server";

import { z } from "zod";
import { defineAction } from "@/lib/actions/define-action";
import { AppError } from "@/lib/errors";
import { updateSettings as updateSettingsService } from "./service";

function getLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "");
  const r = Number.parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = Number.parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = Number.parseInt(cleanHex.substring(4, 6), 16) / 255;

  const [rs, gs, bs] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0);
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function passesWcagAA(color: string): boolean {
  try {
    const contrastVsWhite = getContrastRatio(color, "#ffffff");
    const contrastVsBlack = getContrastRatio(color, "#000000");
    return contrastVsWhite >= 4.5 || contrastVsBlack >= 4.5;
  } catch {
    return false;
  }
}

export const updateSettings = defineAction({
  permission: "settings:update",
  rateLimit: { bucket: "write", limit: 30, windowSeconds: 60 },
  input: z.object({
    collegeName: z.string().trim().min(1, "Institution name is required"),
    timezone: z.string().trim().min(1, "Timezone is required"),
    branding: z
      .object({
        logoUrl: z.string().url().nullable().optional(),
        primaryColor: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-character hex color code"),
        accentColor: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-character hex color code")
          .optional(),
        institutionMotto: z.string().optional(),
        faviconUrl: z.string().url().nullable().optional(),
      })
      .refine((b) => passesWcagAA(b.primaryColor), {
        message:
          "Brand primary color must satisfy WCAG AA contrast requirements (>= 4.5:1 against white or black).",
        path: ["primaryColor"],
      }),
    policies: z
      .object({
        allowSelfRegistration: z.boolean().optional(),
        maxStudentsPerCourse: z.number().int().positive().optional(),
        enforceMfa: z.boolean().optional(),
        sessionTimeoutMinutes: z.number().int().positive().optional(),
      })
      .optional(),
    flags: z.record(z.string(), z.boolean()).optional(),
  }),
  handler: async (tx, actor, input) => {
    // Only super_admin may update college settings
    if (!actor.roles.includes("super_admin")) {
      throw new AppError({
        code: "FORBIDDEN",
        message: "Only super administrators can modify college settings.",
      });
    }

    const updatePayload: Parameters<typeof updateSettingsService>[1] = {
      collegeName: input.collegeName,
      timezone: input.timezone,
      branding: {
        logoUrl: input.branding.logoUrl ?? null,
        primaryColor: input.branding.primaryColor,
        accentColor: input.branding.accentColor ?? "#06b6d4",
        institutionMotto:
          input.branding.institutionMotto ?? "Excellence in Education",
        faviconUrl: input.branding.faviconUrl ?? null,
      },
    };
    if (input.policies) {
      const p: NonNullable<typeof updatePayload.policies> = {};
      if (input.policies.allowSelfRegistration !== undefined) {
        p.allowSelfRegistration = input.policies.allowSelfRegistration;
      }
      if (input.policies.maxStudentsPerCourse !== undefined) {
        p.maxStudentsPerCourse = input.policies.maxStudentsPerCourse;
      }
      if (input.policies.enforceMfa !== undefined) {
        p.enforceMfa = input.policies.enforceMfa;
      }
      if (input.policies.sessionTimeoutMinutes !== undefined) {
        p.sessionTimeoutMinutes = input.policies.sessionTimeoutMinutes;
      }
      updatePayload.policies = p;
    }
    if (input.flags) {
      updatePayload.flags = input.flags;
    }

    const updated = await updateSettingsService(tx, updatePayload);

    return {
      success: true,
      settings: updated,
    };
  },
  audit: (_input, output) => ({
    action: "settings.update",
    resourceType: "settings",
    resourceId: "1",
    after: output.settings,
  }),
});
