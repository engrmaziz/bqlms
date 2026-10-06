import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: ".env" });

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  schemaFilter: ["lms"],
  dbCredentials: {
    url: process.env.DATABASE_URL_SESSION || process.env.DATABASE_URL || "",
  },
});
