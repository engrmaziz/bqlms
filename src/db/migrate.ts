import path from "node:path";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

dotenv.config({ path: ".env" });

const connectionString =
  process.env.DATABASE_URL_SESSION || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Missing DATABASE_URL_SESSION or DATABASE_URL");
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function runMigrations() {
  console.log("Running migrations using DATABASE_URL_SESSION...");
  try {
    await migrate(db, {
      migrationsFolder: path.resolve(import.meta.dirname, "./migrations"),
    });
    console.log("Migrations applied successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
