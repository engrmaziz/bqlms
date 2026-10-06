"use server";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { defineAction } from "@/lib/actions/define-action";
import { notificationPreferencesTable, notificationsTable } from "./schema";

/**
 * Marks a single notification as read for the current actor.
 */
export const markNotificationRead = defineAction({
  input: z.object({
    notificationId: z.string().uuid(),
  }),
  permission: "notification:update",
  handler: async (tx, actor, input) => {
    if (!actor) {
      throw new Error("Actor required");
    }

    await tx
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.id, input.notificationId),
          eq(notificationsTable.userId, actor.userId),
        ),
      );

    return { success: true };
  },
});

/**
 * Marks all unread notifications as read for the current actor.
 */
export const markAllNotificationsRead = defineAction({
  input: z.object({}),
  permission: "notification:update",
  handler: async (tx, actor) => {
    if (!actor) {
      throw new Error("Actor required");
    }

    await tx
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.userId, actor.userId),
          isNull(notificationsTable.readAt),
        ),
      );

    return { success: true };
  },
});

/**
 * Updates delivery preferences (email/push) for a notification category.
 */
export const updateNotificationPreferences = defineAction({
  input: z.object({
    category: z.string(),
    emailEnabled: z.boolean(),
    pushEnabled: z.boolean(),
  }),
  permission: "notification:update",
  handler: async (tx, actor, input) => {
    if (!actor) {
      throw new Error("Actor required");
    }

    await tx
      .insert(notificationPreferencesTable)
      .values({
        userId: actor.userId,
        category:
          input.category as unknown as (typeof notificationPreferencesTable.$inferInsert)["category"],
        email: input.emailEnabled,
        push: input.pushEnabled,
      })
      .onConflictDoUpdate({
        target: [
          notificationPreferencesTable.userId,
          notificationPreferencesTable.category,
        ],
        set: {
          email: input.emailEnabled,
          push: input.pushEnabled,
        },
      });

    return { success: true };
  },
});
