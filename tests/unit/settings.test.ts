import { describe, expect, it } from "vitest";
import {
  brandingSchema,
  flagsSchema,
  policiesSchema,
} from "@/modules/settings";

describe("settings schema defaults", () => {
  it("validates branding defaults", () => {
    const branding = brandingSchema.parse({});
    expect(branding.primaryColor).toBe("#4f46e5");
    expect(branding.institutionMotto).toBe("Excellence in Education");
    expect(branding.logoUrl).toBeNull();
  });

  it("validates policies defaults", () => {
    const policies = policiesSchema.parse({});
    expect(policies.allowSelfRegistration).toBe(false);
    expect(policies.maxStudentsPerCourse).toBe(80);
    expect(policies.sessionTimeoutMinutes).toBe(60);
  });

  it("validates flags defaults", () => {
    const flags = flagsSchema.parse({});
    expect(flags.aiAssistance).toBe(false);
    expect(flags.emailNotifications).toBe(true);
  });
});
