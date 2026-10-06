import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { withTx } from "@/db/tx";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getEmailProvider } from "@/lib/providers/email";
import { userTable } from "@/modules/identity";
import { registerJob } from "@/modules/jobs";
import { getSettings } from "@/modules/settings";
import { getCategoryMetadata, isSecurityCategory } from "./categories";
import { countEmailsSentToday, processDailyDigest } from "./digest";
import { notificationDeliveriesTable, notificationsTable } from "./schema";
import { renderImmediateEmail } from "./templates";

export const SEND_IMMEDIATE_NOTIFICATION_JOB = "notifications:send-immediate";
export const SEND_DIGEST_NOTIFICATION_JOB = "notifications:send-digest";
export const PROCESS_DEFERRED_NOTIFICATIONS_JOB =
  "notifications:process-deferred";

// Register Immediate Email Delivery Job
registerJob(SEND_IMMEDIATE_NOTIFICATION_JOB, {
  schema: z.object({
    deliveryId: z.string().uuid(),
  }),
  handler: async (payload, _ctx) => {
    const emailProvider = getEmailProvider();

    // 1. Fetch delivery & notification details
    const data = await withTx(async (tx) => {
      const [row] = await tx
        .select({
          delivery: notificationDeliveriesTable,
          notification: notificationsTable,
          user: {
            id: userTable.id,
            name: userTable.name,
            email: userTable.email,
          },
        })
        .from(notificationDeliveriesTable)
        .innerJoin(
          notificationsTable,
          eq(notificationDeliveriesTable.notificationId, notificationsTable.id),
        )
        .innerJoin(userTable, eq(notificationsTable.userId, userTable.id))
        .where(eq(notificationDeliveriesTable.id, payload.deliveryId))
        .limit(1);

      return row ?? null;
    });

    if (!data || data.delivery.status !== "queued") {
      return;
    }

    const { delivery, notification, user } = data;
    const isSecurity = isSecurityCategory(notification.category);

    // 2. Check email provider availability
    if (!emailProvider.isAvailable()) {
      await withTx(async (tx) => {
        await tx
          .update(notificationDeliveriesTable)
          .set({
            status: "failed",
            error: "Email provider is unavailable (SMTP not configured)",
          })
          .where(eq(notificationDeliveriesTable.id, delivery.id));
      });
      return;
    }

    // 3. Enforce Daily Cap with 30 reserved for security
    const sentToday = await countEmailsSentToday();
    const hardCap = env.EMAIL_DAILY_CAP;
    const regularCap = Math.max(0, hardCap - 30);

    const isExceeded = isSecurity
      ? sentToday >= hardCap
      : sentToday >= regularCap;

    if (isExceeded) {
      logger.warn(
        { sentToday, hardCap, regularCap, isSecurity, deliveryId: delivery.id },
        "Email daily cap reached; deferring delivery",
      );
      await withTx(async (tx) => {
        await tx
          .update(notificationDeliveriesTable)
          .set({
            status: "deferred",
            error: "Daily sending cap reached; deferred until next day",
          })
          .where(eq(notificationDeliveriesTable.id, delivery.id));
      });
      return;
    }

    // 4. Render and Send Email
    const settings = await getSettings();
    const collegeName = settings.collegeName;
    const notifData = (notification.data as Record<string, unknown>) ?? {};
    const notifTitle = String(notifData.title || "Notification");
    const notifBody = String(notifData.body || "");
    const notifLink =
      typeof notifData.link === "string" ? notifData.link : null;

    const actionUrl = notifLink
      ? notifLink.startsWith("http")
        ? notifLink
        : `${env.NEXT_PUBLIC_APP_URL}${notifLink}`
      : `${env.NEXT_PUBLIC_APP_URL}/notifications`;

    const { html, text } = await renderImmediateEmail({
      collegeName,
      recipientName: user.name,
      title: notifTitle,
      body: notifBody,
      actionUrl,
      categoryLabel: getCategoryMetadata(notification.category).label,
    });

    try {
      await emailProvider.send({
        to: user.email,
        subject: `${collegeName}: ${notifTitle}`,
        html,
        text,
      });

      await withTx(async (tx) => {
        await tx
          .update(notificationDeliveriesTable)
          .set({
            status: "sent",
            sentAt: new Date(),
            error: null,
          })
          .where(eq(notificationDeliveriesTable.id, delivery.id));
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await withTx(async (tx) => {
        await tx
          .update(notificationDeliveriesTable)
          .set({
            status: "failed",
            error: errorMessage,
            attempts: sql`${notificationDeliveriesTable.attempts} + 1`,
          })
          .where(eq(notificationDeliveriesTable.id, delivery.id));
      });
      throw err;
    }
  },
  maxAttempts: 3,
});

// Register Daily Digest Job
registerJob(SEND_DIGEST_NOTIFICATION_JOB, {
  schema: z.object({
    hour: z.string().optional(),
  }),
  handler: async (_payload, _ctx) => {
    logger.info("Executing daily notification digest job");
    const result = await processDailyDigest();
    logger.info(result, "Daily notification digest completed");
  },
  maxAttempts: 3,
});

// Register Deferred Notifications Processing Job
registerJob(PROCESS_DEFERRED_NOTIFICATIONS_JOB, {
  schema: z.object({
    date: z.string().optional(),
  }),
  handler: async (_payload, _ctx) => {
    logger.info(
      "Processing deferred notifications from previous daily cap rollover",
    );

    // Fetch deferred items in priority order:
    // 1. Security (category = 'security')
    // 2. Urgent Deadlines (category = 'deadline_urgent')
    // 3. Others
    const deferredList = await withTx(async (tx) => {
      const rows = await tx
        .select({
          deliveryId: notificationDeliveriesTable.id,
          category: notificationsTable.category,
        })
        .from(notificationDeliveriesTable)
        .innerJoin(
          notificationsTable,
          eq(notificationDeliveriesTable.notificationId, notificationsTable.id),
        )
        .where(
          and(
            eq(notificationDeliveriesTable.channel, "email"),
            eq(notificationDeliveriesTable.status, "deferred"),
          ),
        )
        .limit(100);

      // Sort priority in memory
      return rows.sort((a, b) => {
        const pA =
          a.category === "security"
            ? 3
            : a.category === "deadline" || a.category === "exam"
              ? 2
              : 1;
        const pB =
          b.category === "security"
            ? 3
            : b.category === "deadline" || b.category === "exam"
              ? 2
              : 1;
        return pB - pA;
      });
    });

    for (const item of deferredList) {
      // Re-queue item
      await withTx(async (tx) => {
        await tx
          .update(notificationDeliveriesTable)
          .set({ status: "queued", error: null })
          .where(eq(notificationDeliveriesTable.id, item.deliveryId));
      });

      // Run immediate handler logic
      const handler = (await import("@/modules/jobs")).getJobDefinition(
        SEND_IMMEDIATE_NOTIFICATION_JOB,
      );
      if (handler) {
        await handler.handler(
          { deliveryId: item.deliveryId },
          { jobId: "deferred-proc", attempts: 1 },
        );
      }
    }
  },
  maxAttempts: 3,
});
