import { eq } from "drizzle-orm";
import type { Tx } from "@/db/tx";
import { getJobDefinition } from "./registry";
import { type InsertJob, type Job, jobsTable } from "./schema";

export interface EnqueueOptions {
  runAt?: Date | undefined;
  dedupeKey?: string | undefined;
  maxAttempts?: number | undefined;
}

/**
 * Enqueue a job within an active transaction.
 * Commits atomically with the state change.
 */
export async function enqueue<TPayload>(
  tx: Tx,
  name: string,
  payload: TPayload,
  options?: EnqueueOptions,
): Promise<Job | null> {
  const registered = getJobDefinition(name);
  if (registered) {
    // Validate payload against schema if registered
    registered.schema.parse(payload);
  }

  const maxAttempts = options?.maxAttempts ?? registered?.maxAttempts ?? 3;

  const newJob: InsertJob = {
    name,
    payload,
    runAt: options?.runAt ?? new Date(),
    status: "queued",
    attempts: 0,
    maxAttempts,
    dedupeKey: options?.dedupeKey,
  };

  if (options?.dedupeKey) {
    const inserted = await tx
      .insert(jobsTable)
      .values(newJob)
      .onConflictDoNothing({ target: jobsTable.dedupeKey })
      .returning();

    return inserted[0] ?? null;
  }

  const [inserted] = await tx.insert(jobsTable).values(newJob).returning();
  return inserted ?? null;
}

export async function getJobById(tx: Tx, jobId: string): Promise<Job | null> {
  const [job] = await tx
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId))
    .limit(1);

  return job ?? null;
}
