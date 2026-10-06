import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import type { Tx } from "@/db/tx";
import { AppError } from "@/lib/errors";
import { getSettingsRow } from "./queries";
import {
  type BrandingConfig,
  brandingSchema,
  flagsSchema,
  type PoliciesConfig,
  policiesSchema,
  type Settings,
  settingsTable,
} from "./schema";

const CACHE_TTL_MS = 60 * 1000; // 60 seconds

let cachedSettings: Settings | null = null;
let cacheExpiresAt = 0;

export async function getSettings(
  tx?: Tx,
  options?: { forceFresh?: boolean },
): Promise<Settings> {
  const now = Date.now();
  if (!options?.forceFresh && cachedSettings && now < cacheExpiresAt) {
    return cachedSettings;
  }

  const row = await getSettingsRow(tx ?? db);
  if (!row) {
    const fallback: Settings = {
      id: 1,
      collegeName: "Open College",
      timezone: "UTC",
      locale: "en",
      branding: brandingSchema.parse({}),
      policies: policiesSchema.parse({}),
      flags: flagsSchema.parse({}),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };
    return fallback;
  }

  cachedSettings = row;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return row;
}

export function clearSettingsCache(): void {
  cachedSettings = null;
  cacheExpiresAt = 0;
}

export interface UpdateSettingsInput {
  collegeName?: string;
  timezone?: string;
  locale?: string;
  branding?: Partial<BrandingConfig>;
  policies?: Partial<PoliciesConfig>;
  flags?: Record<string, boolean>;
  expectedVersion?: number;
}

export async function updateSettings(
  tx: Tx,
  input: UpdateSettingsInput,
): Promise<Settings> {
  const current = await getSettings(tx, { forceFresh: true });

  if (
    input.expectedVersion !== undefined &&
    current.version !== input.expectedVersion
  ) {
    throw new AppError({
      code: "CONFLICT",
      message: "Settings have been modified by another transaction.",
    });
  }

  const newBranding = input.branding
    ? brandingSchema.parse({ ...current.branding, ...input.branding })
    : current.branding;

  const newPolicies = input.policies
    ? policiesSchema.parse({ ...current.policies, ...input.policies })
    : current.policies;

  const newFlags = input.flags
    ? flagsSchema.parse({ ...current.flags, ...input.flags })
    : current.flags;

  const updateValues: Partial<typeof settingsTable.$inferInsert> = {
    updatedAt: new Date(),
    version: current.version + 1,
    branding: newBranding,
    policies: newPolicies,
    flags: newFlags,
  };

  if (input.collegeName !== undefined) {
    updateValues.collegeName = input.collegeName;
  }
  if (input.timezone !== undefined) {
    updateValues.timezone = input.timezone;
  }
  if (input.locale !== undefined) {
    updateValues.locale = input.locale;
  }

  const [updated] = await tx
    .update(settingsTable)
    .set(updateValues)
    .where(eq(settingsTable.id, 1))
    .returning();

  if (!updated) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Settings row not found.",
    });
  }

  cachedSettings = updated;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return updated;
}
