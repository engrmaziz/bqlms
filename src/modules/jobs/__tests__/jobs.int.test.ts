import { eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { db } from "@/db/client";
import { withTx } from "@/db/tx";
import {
  drainJobs,
  enqueue,
  getJobById,
  jobsTable,
  reclaimStaleJobs,
  registerJob,
} from "@/modules/jobs";

describe("Jobs Module Integration Tests", () => {
  beforeAll(async () => {
    // Ensure clean state for test job types
    await db.execute(sql`
      DELETE FROM lms.jobs WHERE name LIKE 'test:%'
    `);
  });

  it("proves a job enqueued in a rolled-back transaction never runs", async () => {
    let runCount = 0;
    const jobName = `test:rollback-${uuidv7()}`;

    registerJob(jobName, {
      schema: z.object({ value: z.number() }),
      handler: async () => {
        runCount += 1;
      },
    });

    // Enqueue within a transaction that throws / rolls back
    await expect(
      withTx(async (tx) => {
        await enqueue(tx, jobName, { value: 42 });
        throw new Error("Forced transaction rollback");
      }),
    ).rejects.toThrow("Forced transaction rollback");

    // Verify no job exists in the database
    const jobs = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.name, jobName));

    expect(jobs.length).toBe(0);

    // Drain queue
    await drainJobs(5);
    expect(runCount).toBe(0);
  });

  it("proves two concurrent drains never run the same job", async () => {
    const jobName = `test:concurrent-${uuidv7()}`;
    const executedJobIds: string[] = [];

    registerJob(jobName, {
      schema: z.object({ index: z.number() }),
      handler: async (_payload, ctx) => {
        // Slight artificial delay to test lock overlap
        await new Promise((resolve) => setTimeout(resolve, 30));
        executedJobIds.push(ctx.jobId);
      },
    });

    // Clear leftover jobs to ensure queue is clean for concurrency test
    await db.execute(sql`DELETE FROM lms.jobs`);

    // Enqueue 6 jobs
    await withTx(async (tx) => {
      for (let i = 0; i < 6; i++) {
        await enqueue(tx, jobName, { index: i });
      }
    });

    // Execute two concurrent drains simultaneously
    const [drainA, drainB] = await Promise.all([drainJobs(10), drainJobs(10)]);

    expect(drainA.processed + drainB.processed).toBe(6);
    expect(drainA.succeeded + drainB.succeeded).toBe(6);

    // Each job must be executed exactly once
    expect(executedJobIds.length).toBe(6);
    const uniqueExecuted = new Set(executedJobIds);
    expect(uniqueExecuted.size).toBe(6);
  });

  it("proves a crashed running job is reclaimed after locked_until", async () => {
    const jobName = `test:crash-${uuidv7()}`;
    let executed = false;

    registerJob(jobName, {
      schema: z.object({ payload: z.string() }),
      handler: async () => {
        executed = true;
      },
    });

    // Insert a simulated "crashed" job directly with locked_until in the past
    const pastLock = new Date(Date.now() - 30 * 1000);
    const [crashedJob] = await db
      .insert(jobsTable)
      .values({
        name: jobName,
        payload: { payload: "crashed-worker-data" },
        status: "running",
        attempts: 1,
        maxAttempts: 3,
        lockedUntil: pastLock,
        runAt: pastLock,
      })
      .returning();

    expect(crashedJob).toBeDefined();
    if (!crashedJob) return;

    // Run reclamation
    const reclaimedCount = await reclaimStaleJobs();
    expect(reclaimedCount).toBeGreaterThanOrEqual(1);

    // Verify status was changed to failed and lock cleared
    const refreshed = await withTx(async (tx) => getJobById(tx, crashedJob.id));
    expect(refreshed?.status).toBe("failed");
    expect(refreshed?.lockedUntil).toBeNull();

    // Reset runAt to now so drain can pick it up immediately
    await db
      .update(jobsTable)
      .set({ runAt: new Date(Date.now() - 1000) })
      .where(eq(jobsTable.id, crashedJob.id));

    // Drain and verify completion
    await drainJobs(5);
    expect(executed).toBe(true);

    const doneJob = await withTx(async (tx) => getJobById(tx, crashedJob.id));
    expect(doneJob?.status).toBe("done");
  });

  it("proves a failing job backs off and ends dead after max_attempts", async () => {
    const jobName = `test:failing-${uuidv7()}`;

    registerJob(jobName, {
      schema: z.object({ msg: z.string() }),
      handler: async () => {
        throw new Error("Simulated failure for backoff test");
      },
      maxAttempts: 2,
    });

    const job = await withTx(async (tx) => {
      return enqueue(tx, jobName, { msg: "will fail" }, { maxAttempts: 2 });
    });

    expect(job).toBeDefined();
    if (!job) return;

    // First attempt fails
    await drainJobs(5);

    let state = await withTx(async (tx) => getJobById(tx, job.id));
    expect(state?.status).toBe("failed");
    expect(state?.attempts).toBe(1);
    expect(state?.lastError).toContain("Simulated failure for backoff test");
    expect(state?.runAt.getTime()).toBeGreaterThan(Date.now() - 1000);

    // Fast-forward runAt to make it due for retry
    await db
      .update(jobsTable)
      .set({ runAt: new Date(Date.now() - 1000) })
      .where(eq(jobsTable.id, job.id));

    // Second attempt fails and reaches maxAttempts (2) -> dead
    await drainJobs(5);

    state = await withTx(async (tx) => getJobById(tx, job.id));
    expect(state?.status).toBe("dead");
    expect(state?.attempts).toBe(2);
  });

  it("proves the same dedupeKey enqueues once", async () => {
    const jobName = `test:dedupe-${uuidv7()}`;
    const dedupeKey = `dedupe-key-${uuidv7()}`;

    registerJob(jobName, {
      schema: z.object({ item: z.number() }),
      handler: async () => {},
    });

    const result = await withTx(async (tx) => {
      const first = await enqueue(tx, jobName, { item: 1 }, { dedupeKey });
      const second = await enqueue(tx, jobName, { item: 2 }, { dedupeKey });
      return { first, second };
    });

    expect(result.first).toBeDefined();
    expect(result.first?.id).toBeDefined();
    // The second call with the same dedupeKey returns null
    expect(result.second).toBeNull();

    // Verify only one job exists in table with this dedupe key
    const allJobs = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.dedupeKey, dedupeKey));

    expect(allJobs.length).toBe(1);
    expect(allJobs[0]?.payload).toEqual({ item: 1 });
  });
});
