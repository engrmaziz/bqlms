import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Tx } from "@/db/tx";
import { logger } from "@/lib/logger";
import { registerJob } from "./registry";
import { enqueue } from "./service";

export interface RecurringJobDeclaration {
  name: string;
  bucketType: "hourly" | "daily" | "minute";
  payload: Record<string, unknown>;
}

export const RETENTION_CLEANUP_JOB = "system:retention-cleanup";

// Register retention cleanup job
registerJob(RETENTION_CLEANUP_JOB, {
  schema: z.object({}).passthrough(),
  handler: async (_payload, ctx) => {
    logger.info({ jobId: ctx.jobId }, "Running retention cleanup job");
    const { withTx } = await import("@/db/tx");

    await withTx(async (tx) => {
      // 1. Delete done jobs older than 7 days
      await tx.execute(sql`
        DELETE FROM lms.jobs
        WHERE status = 'done'
          AND created_at < now() - interval '7 days'
      `);

      // 2. Delete rate-limit windows older than 1 day
      await tx.execute(sql`
        DELETE FROM lms.rate_limits
        WHERE window_start < now() - interval '1 day'
      `);

      // 3. Delete processed webhook events older than 30 days
      await tx.execute(sql`
        DELETE FROM lms.webhook_events
        WHERE status = 'processed'
          AND created_at < now() - interval '30 days'
      `);
    });
  },
  maxAttempts: 3,
});

/**
 * Declared recurring tasks enqueued at per-minute ticks with dedupeKey.
 */
export async function scheduleRecurringJobs(tx: Tx): Promise<void> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const hourStr = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH

  // 1. Daily Retention Cleanup
  await enqueue(
    tx,
    RETENTION_CLEANUP_JOB,
    {},
    {
      dedupeKey: `${RETENTION_CLEANUP_JOB}:${dateStr}`,
    },
  );

  // 2. Daily Notification Digest Check (runs hourly bucket; matches college timezone digest_hour)
  await enqueue(
    tx,
    "notifications:send-digest",
    { hour: hourStr },
    {
      dedupeKey: `notifications:send-digest:${hourStr}`,
    },
  );

  // 3. Daily Deferred Notification Processing
  await enqueue(
    tx,
    "notifications:process-deferred",
    { date: dateStr },
    {
      dedupeKey: `notifications:process-deferred:${dateStr}`,
    },
  );

  // 4. Daily Files GC Job (cleans abandoned pending uploads and aged soft-deletes)
  await enqueue(
    tx,
    "files:gc",
    {},
    {
      dedupeKey: `files:gc:${dateStr}`,
    },
  );
}
