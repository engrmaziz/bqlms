import {
  index,
  integer,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { lmsSchema } from "@/db/schema/_shared";

export const rateLimitsTable = lmsSchema.table(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    count: integer("count").notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.key, table.windowStart] }),
    index("rate_limits_window_start_idx").on(table.windowStart),
  ],
);

export type RateLimitsRecord = typeof rateLimitsTable.$inferSelect;
export type InsertRateLimitsRecord = typeof rateLimitsTable.$inferInsert;
