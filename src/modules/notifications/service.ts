import { and, eq, sql } from "drizzle-orm";
import type { Tx } from "@/db/tx";
import { enqueue } from "@/modules/jobs";
import {
  getDefaultDeliveryClass,
  type NotificationCategory,
} from "./categories";
import { getTodayMidnightUtc } from "./digest";
import { SEND_IMMEDIATE_NOTIFICATION_JOB } from "./jobs";
import {
  type Notification,
  type NotificationDelivery,
  type NotificationDeliveryKind,
  notificationDeliveriesTable,
  notificationPreferencesTable,
  notificationsTable,
} from "./schema";

export interface NotifyParams {
  recipient: string; // userId
  template?: string;
  data: {
    title?: string;
    body?: string;
    link?: string;
    [key: string]: unknown;
  };
  category: NotificationCategory;
  dedupeKey?: string;
}

export interface NotifyResult {
  notification: Notification;
  delivery: NotificationDelivery | null;
}

/**
 * Creates an in-app notification and enqueues external deliveries respecting
 * user preferences, per-user immediate limits (max 3/day), and daily caps.
 */
export async function notify(
  tx: Tx,
  params: NotifyParams,
): Promise<NotifyResult> {
  const templateName = params.template ?? "default";

  // 1. In-app feed notification is ALWAYS written
  const insertedNotifications = await tx
    .insert(notificationsTable)
    .values({
      userId: params.recipient,
      category: params.category,
      template: templateName,
      data: params.data,
      dedupeKey: params.dedupeKey,
    })
    .onConflictDoNothing({
      target: notificationsTable.dedupeKey,
    })
    .returning();

  let notification = insertedNotifications[0];
  if (!notification && params.dedupeKey) {
    // If deduped, retrieve existing notification
    const [existing] = await tx
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.dedupeKey, params.dedupeKey))
      .limit(1);
    if (existing) {
      notification = existing;
    }
  }

  if (!notification) {
    throw new Error("Failed to write in-app notification record");
  }

  // 2. Check user notification preferences for this category
  const [pref] = await tx
    .select()
    .from(notificationPreferencesTable)
    .where(
      and(
        eq(notificationPreferencesTable.userId, params.recipient),
        eq(notificationPreferencesTable.category, params.category),
      ),
    )
    .limit(1);

  const isEmailEnabled = pref ? pref.email : true;
  if (!isEmailEnabled) {
    return { notification, delivery: null };
  }

  // 3. Determine delivery class (immediate vs digest)
  let kind: NotificationDeliveryKind = pref?.forceImmediate
    ? "immediate"
    : getDefaultDeliveryClass(params.category);

  // 4. Enforce per-user limit of 3 immediate emails per day (security is exempt)
  if (kind === "immediate" && params.category !== "security") {
    const today = getTodayMidnightUtc().toISOString();
    const result = await tx.execute(sql`
      SELECT count(*)::int as count
      FROM lms.notification_deliveries d
      JOIN lms.notifications n ON d.notification_id = n.id
      WHERE n.user_id = ${params.recipient}
        AND d.channel = 'email'
        AND d.kind = 'immediate'
        AND d.created_at >= ${today}
    `);

    const countRow = (result as unknown as Array<{ count: number }>)[0];
    const immediateToday = Number(countRow?.count ?? 0);

    if (immediateToday >= 3) {
      // 4th+ immediate email of the day rolls into the digest
      kind = "digest";
    }
  }

  // 5. Create delivery record
  const deliveryDedupeKey = params.dedupeKey
    ? `${params.dedupeKey}:email`
    : `${notification.id}:email`;

  const insertedDeliveries = await tx
    .insert(notificationDeliveriesTable)
    .values({
      notificationId: notification.id,
      channel: "email",
      kind,
      status: "queued",
      dedupeKey: deliveryDedupeKey,
    })
    .onConflictDoNothing({
      target: notificationDeliveriesTable.dedupeKey,
    })
    .returning();

  const delivery = insertedDeliveries[0] ?? null;

  // 6. If immediate, enqueue the delivery job atomically in the same transaction
  if (delivery && kind === "immediate") {
    await enqueue(
      tx,
      SEND_IMMEDIATE_NOTIFICATION_JOB,
      { deliveryId: delivery.id },
      {
        ...(deliveryDedupeKey ? { dedupeKey: `job:${deliveryDedupeKey}` } : {}),
      },
    );
  }

  return { notification, delivery };
}
