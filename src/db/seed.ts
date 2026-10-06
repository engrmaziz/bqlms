import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  brandingSchema,
  flagsSchema,
  policiesSchema,
  settingsTable,
} from "@/modules/settings/schema";

dotenv.config({ path: ".env" });

const connectionString =
  process.env.DATABASE_URL_SESSION || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Missing DATABASE_URL_SESSION or DATABASE_URL");
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

export async function seed() {
  console.log("Seeding initial database state...");
  const defaultBranding = brandingSchema.parse({
    logoUrl: null,
    primaryColor: "#4f46e5",
    accentColor: "#06b6d4",
    institutionMotto: "Excellence in Education",
    faviconUrl: null,
  });

  const defaultPolicies = policiesSchema.parse({
    allowSelfRegistration: false,
    maxStudentsPerCourse: 80,
    enforceMfa: false,
    sessionTimeoutMinutes: 60,
  });

  const defaultFlags = flagsSchema.parse({
    aiAssistance: false,
    emailNotifications: true,
    maintenanceMode: false,
  });

  await db
    .insert(settingsTable)
    .values({
      id: 1,
      collegeName: "Open College LMS",
      timezone: "UTC",
      locale: "en",
      branding: defaultBranding,
      policies: defaultPolicies,
      flags: defaultFlags,
      version: 1,
    })
    .onConflictDoUpdate({
      target: settingsTable.id,
      set: {
        collegeName: "Open College LMS",
        timezone: "UTC",
        locale: "en",
        branding: defaultBranding,
        policies: defaultPolicies,
        flags: defaultFlags,
        updatedAt: new Date(),
      },
    });

  console.log("Settings row seeded successfully.");
}

async function run() {
  try {
    await seed();
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("seed.ts")) {
  run();
}
