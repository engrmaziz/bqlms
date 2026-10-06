import {
  boolean,
  index,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { id, lmsSchema } from "@/db/schema/_shared";
import { userTable } from "@/modules/identity/schema";

export const notificationCategoryEnum = lmsSchema.enum(
  "notification_category",
  [
    "security",
    "payment",
    "exam",
    "deadline",
    "announcement",
    "content",
    "grade",
    "forum",
    "message",
    "absence",
    "reminder",
  ],
);

export const notificationChannelEnum = lmsSchema.enum("notification_channel", [
  "email",
  "push",
]);

export const notificationDeliveryKindEnum = lmsSchema.enum(
  "notification_delivery_kind",
  ["immediate", "digest"],
);

export const notificationDeliveryStatusEnum = lmsSchema.enum(
  "notification_delivery_status",
  ["queued", "sent", "failed", "deferred"],
);

export type NotificationCategory =
  (typeof notificationCategoryEnum.enumValues)[number];
export type NotificationChannel =
  (typeof notificationChannelEnum.enumValues)[number];
export type NotificationDeliveryKind =
  (typeof notificationDeliveryKindEnum.enumValues)[number];
export type NotificationDeliveryStatus =
  (typeof notificationDeliveryStatusEnum.enumValues)[number];

export const notificationsTable = lmsSchema.table(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    category: notificationCategoryEnum("category").notNull(),
    template: text("template").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    dedupeKey: text("dedupe_key").unique(),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notifications_user_read_created_idx").on(
      table.userId,
      table.readAt,
      table.createdAt,
    ),
  ],
);

export const notificationDeliveriesTable = lmsSchema.table(
  "notification_deliveries",
  {
    id: id(),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notificationsTable.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    kind: notificationDeliveryKindEnum("kind").notNull(),
    status: notificationDeliveryStatusEnum("status")
      .default("queued")
      .notNull(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    attempts: integer("attempts").default(0).notNull(),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notification_deliveries_status_channel_kind_idx").on(
      table.status,
      table.channel,
      table.kind,
      table.createdAt,
    ),
  ],
);

export const notificationPreferencesTable = lmsSchema.table(
  "notification_preferences",
  {
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    category: notificationCategoryEnum("category").notNull(),
    email: boolean("email").default(true).notNull(),
    push: boolean("push").default(true).notNull(),
    forceImmediate: boolean("force_immediate").default(false).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.category] })],
);

export const notificationUserSettingsTable = lmsSchema.table(
  "notification_user_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => userTable.id, { onDelete: "cascade" }),
    secondDigestHour: integer("second_digest_hour"),
  },
);

export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = typeof notificationsTable.$inferInsert;

export type NotificationDelivery =
  typeof notificationDeliveriesTable.$inferSelect;
export type InsertNotificationDelivery =
  typeof notificationDeliveriesTable.$inferInsert;

export type NotificationPreference =
  typeof notificationPreferencesTable.$inferSelect;
export type InsertNotificationPreference =
  typeof notificationPreferencesTable.$inferInsert;

export type NotificationUserSettings =
  typeof notificationUserSettingsTable.$inferSelect;
export type InsertNotificationUserSettings =
  typeof notificationUserSettingsTable.$inferInsert;
