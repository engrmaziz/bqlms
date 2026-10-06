import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod";

export const lmsSchema = pgSchema("lms");

export const brandingSchema = z
  .object({
    logoUrl: z.string().url().nullable().default(null),
    primaryColor: z.string().default("#4f46e5"),
    accentColor: z.string().default("#06b6d4"),
    institutionMotto: z.string().default("Excellence in Education"),
    faviconUrl: z.string().url().nullable().default(null),
  })
  .default({
    logoUrl: null,
    primaryColor: "#4f46e5",
    accentColor: "#06b6d4",
    institutionMotto: "Excellence in Education",
    faviconUrl: null,
  });

export type BrandingConfig = z.infer<typeof brandingSchema>;

export const policiesSchema = z
  .object({
    allowSelfRegistration: z.boolean().default(false),
    maxStudentsPerCourse: z.number().int().positive().default(80),
    enforceMfa: z.boolean().default(false),
    sessionTimeoutMinutes: z.number().int().positive().default(60),
  })
  .default({
    allowSelfRegistration: false,
    maxStudentsPerCourse: 80,
    enforceMfa: false,
    sessionTimeoutMinutes: 60,
  });

export type PoliciesConfig = z.infer<typeof policiesSchema>;

export const defaultFlags: Record<string, boolean> = {
  aiAssistance: false,
  emailNotifications: true,
  maintenanceMode: false,
};

export const flagsSchema = z
  .record(z.string(), z.boolean())
  .default(defaultFlags)
  .transform(
    (flags): Record<string, boolean> => ({
      ...defaultFlags,
      ...flags,
    }),
  );

export type FlagsConfig = Record<string, boolean>;

export const settingsTable = lmsSchema.table(
  "settings",
  {
    id: integer("id").primaryKey().default(1),
    collegeName: text("college_name").notNull().default("Open College"),
    timezone: text("timezone").notNull().default("UTC"),
    locale: text("locale").notNull().default("en"),
    branding: jsonb("branding")
      .$type<BrandingConfig>()
      .notNull()
      .default(brandingSchema.parse({})),
    policies: jsonb("policies")
      .$type<PoliciesConfig>()
      .notNull()
      .default(policiesSchema.parse({})),
    flags: jsonb("flags")
      .$type<FlagsConfig>()
      .notNull()
      .default(flagsSchema.parse({})),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [check("settings_single_row_check", sql`${table.id} = 1`)],
);

export type Settings = typeof settingsTable.$inferSelect;
export type InsertSettings = typeof settingsTable.$inferInsert;
