import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  type Notification,
  type NotificationPreference,
  notificationPreferencesTable,
  notificationsTable,
} from "./schema";

export async function getUnreadNotificationsCount(
  userId: string,
): Promise<number> {
  const result = await db.execute(sql`
    SELECT count(*)::int as count
    FROM lms.notifications
    WHERE user_id = ${userId}
      AND read_at IS NULL
  `);

  const row = (result as unknown as Array<{ count: number }>)[0];
  return Number(row?.count ?? 0);
}

export async function listUserNotifications(
  userId: string,
  limit = 50,
): Promise<Notification[]> {
  return db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit);
}

export async function getUserPreferences(
  userId: string,
): Promise<NotificationPreference[]> {
  return db
    .select()
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, userId));
}
