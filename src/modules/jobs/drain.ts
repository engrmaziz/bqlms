import { sql } from "drizzle-orm";
import { withTx } from "@/db/tx";
import { logger } from "@/lib/logger";
import { getJobDefinition } from "./registry";
import type { Job } from "./schema";

export interface DrainResult {
  processed: number;
  succeeded: number;
  failed: number;
}

/**
 * Reclaim stale jobs whose locks expired (e.g. process crashed).
 */
export async function reclaimStaleJobs(): Promise<number> {
  return withTx(async (tx) => {
    const result = await tx.execute(sql`
      UPDATE lms.jobs
      SET status = CASE 
            WHEN attempts >= max_attempts THEN 'dead'::lms.job_status 
            ELSE 'failed'::lms.job_status 
          END,
          locked_until = NULL,
          last_error = 'Worker lock expired (possible process termination)',
          run_at = CASE 
            WHEN attempts >= max_attempts THEN run_at 
            ELSE now() + interval '5 seconds' 
          END
      WHERE status = 'running' 
        AND locked_until IS NOT NULL 
        AND locked_until < now()
      RETURNING id
    `);

    const count = (result as unknown as { length?: number }).length ?? 0;
    if (count > 0) {
      logger.warn({ count }, "Reclaimed stale background jobs");
    }
    return count;
  });
}

/**
 * Atomically claim up to batchSize due jobs using FOR UPDATE SKIP LOCKED.
 */
export async function claimDueJobs(batchSize = 5): Promise<Job[]> {
  return withTx(async (tx) => {
    // Select & lock rows, update to running
    const result = await tx.execute(sql`
      WITH candidate AS (
        SELECT id
        FROM lms.jobs
        WHERE (status = 'queued' OR (status = 'failed' AND attempts < max_attempts))
          AND run_at <= now()
          AND (locked_until IS NULL OR locked_until <= now())
        ORDER BY run_at ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE lms.jobs j
      SET status = 'running'::lms.job_status,
          attempts = j.attempts + 1,
          locked_until = now() + interval '2 minutes'
      FROM candidate c
      WHERE j.id = c.id
      RETURNING 
        j.id,
        j.name,
        j.payload,
        j.run_at,
        j.status,
        j.attempts,
        j.max_attempts,
        j.locked_until,
        j.last_error,
        j.dedupe_key,
        j.created_at;
    `);

    const rows =
      (result as unknown as Array<{
        id: string;
        name: string;
        payload: unknown;
        run_at: string | Date;
        status: Job["status"];
        attempts: number;
        max_attempts: number;
        locked_until: string | Date | null;
        last_error: string | null;
        dedupe_key: string | null;
        created_at: string | Date;
      }>) ?? [];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      payload: r.payload,
      runAt: new Date(r.run_at),
      status: r.status,
      attempts: Number(r.attempts),
      maxAttempts: Number(r.max_attempts),
      lockedUntil: r.locked_until ? new Date(r.locked_until) : null,
      lastError: r.last_error,
      dedupeKey: r.dedupe_key,
      createdAt: new Date(r.created_at),
    }));
  });
}

/**
 * Execute a single claimed job.
 */
async function executeJob(job: Job): Promise<boolean> {
  const definition = getJobDefinition(job.name);

  if (!definition) {
    const isDead = job.attempts >= job.maxAttempts;
    await withTx(async (tx) => {
      await tx.execute(sql`
        UPDATE lms.jobs
        SET status = ${isDead ? "dead" : "failed"}::lms.job_status,
            locked_until = NULL,
            last_error = ${`No handler registered for job: ${job.name}`}
        WHERE id = ${job.id}
      `);
    });
    return false;
  }

  // Validate payload
  const parseResult = definition.schema.safeParse(job.payload);
  if (!parseResult.success) {
    const errorMessage = `Payload schema validation failed: ${parseResult.error.message}`;
    await withTx(async (tx) => {
      await tx.execute(sql`
        UPDATE lms.jobs
        SET status = 'dead'::lms.job_status,
            locked_until = NULL,
            last_error = ${errorMessage}
        WHERE id = ${job.id}
      `);
    });
    return false;
  }

  try {
    // Execute handler
    await definition.handler(parseResult.data, {
      jobId: job.id,
      attempts: job.attempts,
    });

    // Mark done
    await withTx(async (tx) => {
      await tx.execute(sql`
        UPDATE lms.jobs
        SET status = 'done'::lms.job_status,
            locked_until = NULL,
            last_error = NULL
        WHERE id = ${job.id}
      `);
    });
    return true;
  } catch (error) {
    const isDead = job.attempts >= job.maxAttempts;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Exponential backoff: 2^(attempts-1) * 10 seconds, up to 1 hour
    const backoffSeconds = Math.min(
      3600,
      2 ** Math.max(0, job.attempts - 1) * 10,
    );

    await withTx(async (tx) => {
      await tx.execute(sql`
        UPDATE lms.jobs
        SET status = ${isDead ? "dead" : "failed"}::lms.job_status,
            locked_until = NULL,
            last_error = ${errorMessage},
            run_at = ${isDead ? sql`run_at` : sql`now() + (${backoffSeconds} * interval '1 second')`}
        WHERE id = ${job.id}
      `);
    });

    logger.error(
      { jobId: job.id, name: job.name, attempts: job.attempts, error },
      "Job execution failed",
    );
    return false;
  }
}

/**
 * Drain queued jobs in loops with a default 45-second execution budget.
 */
export async function drainJobs(maxDurationSeconds = 45): Promise<DrainResult> {
  const deadline = Date.now() + maxDurationSeconds * 1000;
  const result: DrainResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
  };

  // 1. Reclaim dead/crashed rows whose locks expired
  await reclaimStaleJobs();

  // 2. Process due jobs until budget exhausted or queue empty
  while (Date.now() < deadline) {
    const jobs = await claimDueJobs(5);
    if (!jobs.length) {
      break;
    }

    for (const job of jobs) {
      result.processed += 1;
      const success = await executeJob(job);
      if (success) {
        result.succeeded += 1;
      } else {
        result.failed += 1;
      }

      // Check if we reached deadline
      if (Date.now() >= deadline) {
        break;
      }
    }
  }

  return result;
}
