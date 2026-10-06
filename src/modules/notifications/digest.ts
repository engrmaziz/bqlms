import { and, eq, inArray, sql } from "drizzle-orm";
import { withTx } from "@/db/tx";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getEmailProvider } from "@/lib/providers/email";
import { userTable } from "@/modules/identity";
import { getSettings } from "@/modules/settings";
import { getCategoryMetadata } from "./categories";
import { notificationDeliveriesTable, notificationsTable } from "./schema";
import { type DigestItem, renderDigestEmail } from "./templates";

/**
 * Returns today's midnight timestamp in UTC.
 */
export function getTodayMidnightUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

/**
 * Counts total emails sent today to enforce the daily cap.
 */
export async function countEmailsSentToday(): Promise<number> {
  return withTx(async (tx) => {
    const today = getTodayMidnightUtc().toISOString();
    const result = await tx.execute(sql`
      SELECT count(*)::int as count
      FROM lms.notification_deliveries
      WHERE channel = 'email'
        AND status = 'sent'
        AND sent_at >= ${today}
    `);

    const row = (result as unknown as Array<{ count: number }>)[0];
    return Number(row?.count ?? 0);
  });
}

/**
 * Process all queued digest deliveries across users.
 * One digest email per user per day grouping unread items.
 */
export async function processDailyDigest(): Promise<{
  usersProcessed: number;
  emailsSent: number;
  deferred: number;
}> {
  const emailProvider = getEmailProvider();
  if (!emailProvider.isAvailable()) {
    logger.info("Email provider unavailable, skipping daily digest processing");
    return { usersProcessed: 0, emailsSent: 0, deferred: 0 };
  }

  const settings = await getSettings();
  const collegeName = settings.collegeName;
  const portalUrl = `${env.NEXT_PUBLIC_APP_URL}/notifications`;

  let emailsSent = 0;
  let deferredCount = 0;
  let usersProcessed = 0;

  // Find users who have queued digest deliveries
  const candidateUsers = await withTx(async (tx) => {
    const rows = await tx.execute(sql`
      SELECT DISTINCT n.user_id
      FROM lms.notification_deliveries d
      JOIN lms.notifications n ON d.notification_id = n.id
      WHERE d.channel = 'email'
        AND d.kind = 'digest'
        AND d.status = 'queued'
      LIMIT 100
    `);

    return (rows as unknown as Array<{ user_id: string }>).map(
      (r) => r.user_id,
    );
  });

  for (const userId of candidateUsers) {
    usersProcessed += 1;

    // Check capacity for regular digest emails (daily cap minus 30 security reserve)
    const sentToday = await countEmailsSentToday();
    const regularCap = Math.max(0, env.EMAIL_DAILY_CAP - 30);

    if (sentToday >= regularCap) {
      // Over capacity: defer queued digest deliveries for this user
      await withTx(async (tx) => {
        await tx.execute(sql`
          UPDATE lms.notification_deliveries d
          SET status = 'deferred'::lms.notification_delivery_status
          FROM lms.notifications n
          WHERE d.notification_id = n.id
            AND n.user_id = ${userId}
            AND d.channel = 'email'
            AND d.kind = 'digest'
            AND d.status = 'queued'
        `);
      });
      deferredCount += 1;
      continue;
    }

    // Fetch user and unread notifications with queued deliveries
    const userPayload = await withTx(async (tx) => {
      const [user] = await tx
        .select({
          id: userTable.id,
          name: userTable.name,
          email: userTable.email,
        })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);

      if (!user) return null;

      const items = await tx
        .select({
          deliveryId: notificationDeliveriesTable.id,
          notificationId: notificationsTable.id,
          data: notificationsTable.data,
          category: notificationsTable.category,
          readAt: notificationsTable.readAt,
        })
        .from(notificationDeliveriesTable)
        .innerJoin(
          notificationsTable,
          eq(notificationDeliveriesTable.notificationId, notificationsTable.id),
        )
        .where(
          and(
            eq(notificationsTable.userId, userId),
            eq(notificationDeliveriesTable.channel, "email"),
            eq(notificationDeliveriesTable.kind, "digest"),
            eq(notificationDeliveriesTable.status, "queued"),
          ),
        );

      return { user, items };
    });

    if (!userPayload || userPayload.items.length === 0) {
      continue;
    }

    const { user, items } = userPayload;

    // Filter to items that are unread
    const unreadItems = items.filter((item) => !item.readAt);
    if (unreadItems.length === 0) {
      // Mark deliveries as sent without sending an empty email
      const deliveryIds = items.map((i) => i.deliveryId);
      await withTx(async (tx) => {
        await tx
          .update(notificationDeliveriesTable)
          .set({ status: "sent", sentAt: new Date() })
          .where(inArray(notificationDeliveriesTable.id, deliveryIds));
      });
      continue;
    }

    const digestItems: DigestItem[] = unreadItems.map((item) => {
      const data = item.data as Record<string, unknown>;
      const title = String(data?.title || "Notification");
      const body = String(data?.body || "");
      const link = typeof data?.link === "string" ? data.link : null;
      return {
        title,
        body,
        categoryLabel: getCategoryMetadata(item.category).label,
        link: link
          ? link.startsWith("http")
            ? link
            : `${env.NEXT_PUBLIC_APP_URL}${link}`
          : null,
      };
    });

    const { html, text } = await renderDigestEmail({
      collegeName,
      recipientName: user.name,
      items: digestItems,
      portalUrl,
    });

    try {
      await emailProvider.send({
        to: user.email,
        subject: `${collegeName} Daily Digest: ${digestItems.length} new update${digestItems.length === 1 ? "" : "s"}`,
        html,
        text,
      });

      const deliveryIds = items.map((i) => i.deliveryId);
      await withTx(async (tx) => {
        await tx
          .update(notificationDeliveriesTable)
          .set({ status: "sent", sentAt: new Date() })
          .where(inArray(notificationDeliveriesTable.id, deliveryIds));
      });

      emailsSent += 1;
    } catch (err) {
      logger.error({ err, userId }, "Failed to send daily digest email");
      const deliveryIds = items.map((i) => i.deliveryId);
      await withTx(async (tx) => {
        await tx
          .update(notificationDeliveriesTable)
          .set({
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
            attempts: sql`${notificationDeliveriesTable.attempts} + 1`,
          })
          .where(inArray(notificationDeliveriesTable.id, deliveryIds));
      });
    }
  }

  return { usersProcessed, emailsSent, deferred: deferredCount };
}
