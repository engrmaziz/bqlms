import { index, jsonb, text, timestamp } from "drizzle-orm/pg-core";
import { id, lmsSchema } from "@/db/schema/_shared";

export const auditLogsTable = lmsSchema.table(
  "audit_logs",
  {
    id: id(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    requestId: text("request_id").notNull(),
    at: timestamp("at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_logs_at_idx").on(table.at.desc()),
    index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
  ],
);

export type AuditLog = typeof auditLogsTable.$inferSelect;
export type InsertAuditLog = typeof auditLogsTable.$inferInsert;
