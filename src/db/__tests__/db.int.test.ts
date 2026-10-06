import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, pgClient } from "@/db/client";
import { settingsTable } from "@/db/schema";
import { withTx } from "@/db/tx";

describe("db integration invariants", () => {
  it("rejects a second settings row via CHECK and PK constraints", async () => {
    // 1. Attempting to insert a row with id != 1 violates CHECK constraint
    await expect(
      db.insert(settingsTable).values({
        id: 2,
        collegeName: "Second College",
      }),
    ).rejects.toThrow();

    // 2. Attempting to insert another row with id = 1 violates PK constraint
    await expect(
      db.insert(settingsTable).values({
        id: 1,
        collegeName: "Duplicate College",
      }),
    ).rejects.toThrow();
  });

  it("rolls back transactions when withTx callback throws", async () => {
    const [original] = await db
      .select({ collegeName: settingsTable.collegeName })
      .from(settingsTable)
      .where(eq(settingsTable.id, 1));

    expect(original).toBeDefined();
    const originalName = original?.collegeName ?? "Open College LMS";

    const testFailureMsg = "Intentional transaction failure for rollback test";

    await expect(
      withTx(async (tx) => {
        await tx
          .update(settingsTable)
          .set({ collegeName: "Rolled Back College Name" })
          .where(eq(settingsTable.id, 1));

        throw new Error(testFailureMsg);
      }),
    ).rejects.toThrow(testFailureMsg);

    // Verify database state was not modified
    const [afterRollback] = await db
      .select({ collegeName: settingsTable.collegeName })
      .from(settingsTable)
      .where(eq(settingsTable.id, 1));

    expect(afterRollback?.collegeName).toBe(originalName);
  });

  it("completes 50 concurrent transactions on a pool of 3 without connection errors", async () => {
    const promises = Array.from({ length: 50 }, (_, i) =>
      withTx(async (tx) => {
        const result = await tx.execute(sql`SELECT ${i}::int as num`);
        const row = result[0] as { num: number } | undefined;
        return row?.num;
      }),
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(50);
    for (let i = 0; i < 50; i++) {
      expect(results[i]).toBe(i);
    }
  });

  it("cancels a query exceeding statement_timeout (5s)", async () => {
    try {
      await pgClient`SELECT pg_sleep(6)`;
      expect.fail("Query should have been cancelled by statement_timeout");
    } catch (error: unknown) {
      expect(error).toBeDefined();
      const pgError = error as { code?: string; message?: string };
      // Postgres error code 57014 = query_canceled
      expect(pgError.code).toBe("57014");
    }
  });
});
