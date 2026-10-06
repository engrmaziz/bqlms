import { index, jsonb, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { lmsSchema } from "@/db/schema/_shared";

export const idempotencyKeysTable = lmsSchema.table(
  "idempotency_keys",
  {
    key: text("key").notNull(),
    actorId: text("actor_id").notNull(),
    requestHash: text("request_hash").notNull(),
    response: jsonb("response").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.key, table.actorId] }),
    index("idempotency_keys_expires_at_idx").on(table.expiresAt),
  ],
);

export type IdempotencyRecord = typeof idempotencyKeysTable.$inferSelect;
export type InsertIdempotencyRecord = typeof idempotencyKeysTable.$inferInsert;
