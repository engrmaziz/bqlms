import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Tx } from "@/db/tx";
import { enqueue, registerJob } from "@/modules/jobs";
import { getWebhookHandler } from "./handlers";
import {
  type InsertWebhookEvent,
  type WebhookEvent,
  webhookEventsTable,
} from "./schema";

export const PROCESS_WEBHOOK_JOB = "webhooks:process-event";

// Register the background processing job for webhooks
registerJob(PROCESS_WEBHOOK_JOB, {
  schema: z.object({
    eventId: z.string().uuid(),
  }),
  handler: async (payload, _ctx) => {
    const { withTx } = await import("@/db/tx");

    await withTx(async (tx) => {
      const [event] = await tx
        .select()
        .from(webhookEventsTable)
        .where(eq(webhookEventsTable.id, payload.eventId))
        .limit(1);

      if (!event || event.status !== "pending") {
        return;
      }

      const handler = getWebhookHandler(event.provider);
      if (handler) {
        await handler.process(event, tx);
      }

      await tx
        .update(webhookEventsTable)
        .set({ status: "processed", processedAt: new Date() })
        .where(eq(webhookEventsTable.id, event.id));
    });
  },
  maxAttempts: 3,
});

export interface RecordWebhookResult {
  duplicate: boolean;
  event: WebhookEvent | null;
}

/**
 * Inserts a webhook event and enqueues background processing atomically.
 * If the event was already received (duplicate externalId), ignores without re-enqueuing.
 */
export async function recordWebhookEvent(
  tx: Tx,
  provider: string,
  externalId: string,
  payload: unknown,
): Promise<RecordWebhookResult> {
  const newEvent: InsertWebhookEvent = {
    provider,
    externalId,
    payload,
    status: "pending",
  };

  const inserted = await tx
    .insert(webhookEventsTable)
    .values(newEvent)
    .onConflictDoNothing({
      target: [webhookEventsTable.provider, webhookEventsTable.externalId],
    })
    .returning();

  const event = inserted[0];
  if (!event) {
    return { duplicate: true, event: null };
  }

  // Atomically enqueue background processing job in the same transaction
  await enqueue(
    tx,
    PROCESS_WEBHOOK_JOB,
    { eventId: event.id },
    { dedupeKey: `webhook:${provider}:${externalId}` },
  );

  return { duplicate: false, event };
}

export async function getWebhookEventById(
  tx: Tx,
  eventId: string,
): Promise<WebhookEvent | null> {
  const [event] = await tx
    .select()
    .from(webhookEventsTable)
    .where(eq(webhookEventsTable.id, eventId))
    .limit(1);

  return event ?? null;
}
