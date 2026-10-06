import { index, integer, jsonb, text, timestamp } from "drizzle-orm/pg-core";
import { id, lmsSchema } from "@/db/schema/_shared";

export const jobStatusEnum = lmsSchema.enum("job_status", [
  "queued",
  "running",
  "done",
  "failed",
  "dead",
]);

export type JobStatus = (typeof jobStatusEnum.enumValues)[number];

export const jobsTable = lmsSchema.table(
  "jobs",
  {
    id: id(),
    name: text("name").notNull(),
    payload: jsonb("payload").$type<unknown>().notNull(),
    runAt: timestamp("run_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    status: jobStatusEnum("status").default("queued").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    lockedUntil: timestamp("locked_until", {
      withTimezone: true,
      mode: "date",
    }),
    lastError: text("last_error"),
    dedupeKey: text("dedupe_key").unique(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("jobs_status_run_at_idx").on(table.status, table.runAt),
    index("jobs_locked_until_idx").on(table.lockedUntil),
  ],
);

export type Job = typeof jobsTable.$inferSelect;
export type InsertJob = typeof jobsTable.$inferInsert;
