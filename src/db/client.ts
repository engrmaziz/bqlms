import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";

const globalForDb = globalThis as unknown as {
  pgClient?: postgres.Sql;
};

export const pgClient =
  globalForDb.pgClient ??
  postgres(env.DATABASE_URL, {
    prepare: false,
    max: 3,
    connect_timeout: 10,
    connection: {
      statement_timeout: 5000,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = pgClient;
}

export const db = drizzle(pgClient, { schema });
export type Database = typeof db;
