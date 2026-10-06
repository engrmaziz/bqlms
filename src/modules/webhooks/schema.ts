import {
  index,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { id, lmsSchema } from "@/db/schema/_shared";

export const webhookEventStatusEnum = lmsSchema.enum("webhook_event_status", [
  "pending",
  "processed",
  "failed",
]);

export type WebhookEventStatus =
  (typeof webhookEventStatusEnum.enumValues)[number];

export const webhookEventsTable = lmsSchema.table(
  "webhook_events",
  {
    id: id(),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    payload: jsonb("payload").$type<unknown>().notNull(),
    status: webhookEventStatusEnum("status").default("pending").notNull(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    uniqueIndex("webhook_events_provider_external_id_uidx").on(
      table.provider,
      table.externalId,
    ),
    index("webhook_events_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);

export type WebhookEvent = typeof webhookEventsTable.$inferSelect;
export type InsertWebhookEvent = typeof webhookEventsTable.$inferInsert;
