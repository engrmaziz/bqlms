import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { uuidv7 } from "uuidv7";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { db } from "@/db/client";
import { sessionTable } from "@/db/schema";
import { defineRoute } from "@/lib/api/define-route";
import type { Actor } from "@/lib/auth/session";
import { checkRateLimit, rateLimitsTable } from "@/lib/rate-limit";
import { auditLogsTable } from "@/modules/audit";
import { createUserWithProfile } from "@/modules/identity";
import { defineAction } from "../define-action";

function makeActor(overrides: Partial<Actor> = {}): Actor {
  const userId = overrides.userId ?? `usr-${Date.now()}-${Math.random()}`;
  return {
    userId,
    email: `${userId}@college.edu`,
    name: "Pipeline Test Actor",
    roles: ["student"],
    status: "active",
    twoFactorEnabled: false,
    profile: {
      userId,
      roles: overrides.roles ?? ["student"],
      status: "active",
      studentNumber: null,
      employeeId: null,
      phone: null,
      createdAt: new Date(),
    },
    ...overrides,
  };
}

describe("Mutation & API Pipeline Invariants (Integration)", () => {
  let adminUserId: string;
  let adminSessionToken: string;

  beforeAll(async () => {
    const adminEmail = `pipeline_admin_${Date.now()}@college.edu`;
    const { user } = await createUserWithProfile({
      name: "Pipeline Administrator",
      email: adminEmail,
      password: "SuperSecretAdmin123!",
      roles: ["super_admin", "admin"],
      status: "active",
    });
    adminUserId = user.id;

    adminSessionToken = `pipeline_sess_${Date.now()}`;
    await db.insert(sessionTable).values({
      id: uuidv7(),
      token: adminSessionToken,
      userId: adminUserId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  });

  it("a forbidden call writes nothing, including no audit row", async () => {
    const student = makeActor({ roles: ["student"] });
    const targetResourceId = `res-forbidden-${Date.now()}`;

    const testAction = defineAction({
      permission: "settings:update",
      input: z.object({ settingValue: z.string() }),
      audit: {
        action: "settings.update",
        resourceType: "setting",
        resourceId: targetResourceId,
      },
      handler: async () => {
        return { success: true };
      },
    });

    // Invoke action with student actor (lacks settings:update)
    const result = await testAction(
      { settingValue: "malicious" },
      { actor: student },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }

    // Assert that NO audit log row was written to Postgres
    const auditRows = await db
      .select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.resourceId, targetResourceId));

    expect(auditRows.length).toBe(0);
  });

  it("a handler exception rolls back the audit row", async () => {
    const admin = makeActor({ userId: adminUserId, roles: ["admin"] });
    const targetResourceId = `res-rollback-${Date.now()}`;

    const failingAction = defineAction({
      permission: "settings:update",
      input: z.object({ value: z.string() }),
      audit: {
        action: "settings.update",
        resourceType: "setting",
        resourceId: targetResourceId,
      },
      handler: async () => {
        // Handler throws an unexpected exception inside transaction
        throw new Error("Simulated database failure during mutation");
      },
    });

    const result = await failingAction(
      { value: "will-fail" },
      { actor: admin },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL");
    }

    // Assert transaction rollback: zero audit rows exist for this resource
    const auditRows = await db
      .select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.resourceId, targetResourceId));

    expect(auditRows.length).toBe(0);
  });

  it("an idempotent replay returns the stored response without re-running the handler", async () => {
    let executionCount = 0;
    const idempotencyKey = `idemp-key-${Date.now()}-${Math.random()}`;

    const testRoute = defineRoute({
      permission: "settings:update",
      input: z.object({ key: z.string(), val: z.string() }),
      handler: async (_tx, _actor, input) => {
        executionCount += 1;
        return { count: executionCount, savedKey: input?.key };
      },
    });

    const _cookieHeader = `bqlms.session_token=${adminSessionToken}`;

    const admin = makeActor({ userId: adminUserId, roles: ["admin"] });

    // 1. First execution
    const req1 = new NextRequest("http://localhost:3005/api/v1/test-idemp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ key: "theme", val: "dark" }),
    });

    const res1 = await testRoute(req1, { actor: admin });
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1).toEqual({ count: 1, savedKey: "theme" });
    expect(executionCount).toBe(1);

    // 2. Second execution with identical payload -> should replay cached response
    const req2 = new NextRequest("http://localhost:3005/api/v1/test-idemp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ key: "theme", val: "dark" }),
    });

    const res2 = await testRoute(req2, { actor: admin });
    expect(res2.status).toBe(200);
    expect(res2.headers.get("x-idempotent-replay")).toBe("true");
    const body2 = await res2.json();
    expect(body2).toEqual({ count: 1, savedKey: "theme" });
    // Handler must NOT have executed a second time
    expect(executionCount).toBe(1);

    // 3. Third execution with SAME key but DIFFERENT payload -> must return 409 Conflict
    const req3 = new NextRequest("http://localhost:3005/api/v1/test-idemp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ key: "theme", val: "LIGHT_TAMPERED" }),
    });

    const res3 = await testRoute(req3, { actor: admin });
    expect(res3.status).toBe(409);
    const body3 = await res3.json();
    expect(body3.code).toBe("CONFLICT");
    expect(executionCount).toBe(1);
  });

  it("the rate limiter returns RATE_LIMITED at the limit and counts correctly under 20 concurrent calls", async () => {
    const testIdentifier = `user-concurrency-${Date.now()}`;
    const limit = 5;
    const windowSeconds = 60;

    // Fire 20 concurrent requests simultaneously
    const tasks = Array.from({ length: 20 }, () =>
      checkRateLimit({
        bucket: "write",
        identifier: testIdentifier,
        limit,
        windowSeconds,
      }),
    );

    const results = await Promise.all(tasks);

    // Exactly 5 should be allowed (limit is 5)
    const allowedCount = results.filter((r) => r.allowed).length;
    const rejectedCount = results.filter((r) => !r.allowed).length;

    expect(allowedCount).toBe(5);
    expect(rejectedCount).toBe(15);

    // Verify the Postgres table count is exactly 20
    const compositeKey = `write:${testIdentifier}`;
    const rows = await db
      .select()
      .from(rateLimitsTable)
      .where(eq(rateLimitsTable.key, compositeKey));

    expect(rows.length).toBe(1);
    expect(rows[0]?.count).toBe(20);
  });
});
