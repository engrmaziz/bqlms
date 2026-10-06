import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { uuidv7 } from "uuidv7";
import { describe, expect, it } from "vitest";
import { POST as tickHandler } from "@/app/api/internal/tick/route";
import { POST as webhookHandler } from "@/app/api/webhooks/[provider]/route";
import { db } from "@/db/client";
import { env } from "@/lib/env";
import { jobsTable } from "@/modules/jobs";
import { webhookEventsTable } from "../schema";
import { PROCESS_WEBHOOK_JOB } from "../service";

describe("Webhooks and Internal Tick Integration Tests", () => {
  describe("Internal Tick Endpoint (/api/internal/tick)", () => {
    it("proves a tick without the secret is rejected (401 and 403)", async () => {
      // 1. Missing Authorization header -> 401
      const reqMissing = new NextRequest(
        "http://localhost:3000/api/internal/tick",
        {
          method: "POST",
        },
      );
      const resMissing = await tickHandler(reqMissing);
      expect(resMissing.status).toBe(401);

      // 2. Invalid secret in Authorization header -> 403
      const reqInvalid = new NextRequest(
        "http://localhost:3000/api/internal/tick",
        {
          method: "POST",
          headers: {
            authorization: "Bearer wrong-secret-token",
          },
        },
      );
      const resInvalid = await tickHandler(reqInvalid);
      expect(resInvalid.status).toBe(403);

      // 3. Valid secret -> 200 OK
      const reqValid = new NextRequest(
        "http://localhost:3000/api/internal/tick",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${env.CRON_SECRET}`,
          },
        },
      );
      const resValid = await tickHandler(reqValid);
      expect(resValid.status).toBe(200);
      const data = (await resValid.json()) as { success: boolean };
      expect(data.success).toBe(true);
    });
  });

  describe("Webhook Route (/api/webhooks/[provider])", () => {
    it("returns 404 for an unknown provider", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/webhooks/unknown-provider",
        {
          method: "POST",
          body: JSON.stringify({ hello: "world" }),
        },
      );

      const res = await webhookHandler(req, {
        params: Promise.resolve({ provider: "unknown-provider" }),
      });

      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("Webhook provider not supported");
    });

    it("returns 401 when signature verification fails", async () => {
      const payload = JSON.stringify({ event: "ping" });
      const req = new NextRequest("http://localhost:3000/api/webhooks/test", {
        method: "POST",
        body: payload,
        headers: {
          "x-webhook-signature": "bad-signature",
        },
      });

      const res = await webhookHandler(req, {
        params: Promise.resolve({ provider: "test" }),
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("signature verification failed");
    });

    it("verifies signature, records event, enqueues processing job, and dedupes replays with 200", async () => {
      const externalId = `evt_${uuidv7()}`;
      const payload = JSON.stringify({
        id: externalId,
        action: "item.created",
        timestamp: Date.now(),
      });

      const signature = crypto
        .createHmac("sha256", "test-webhook-secret")
        .update(payload)
        .digest("hex");

      // 1. First delivery
      const req1 = new NextRequest("http://localhost:3000/api/webhooks/test", {
        method: "POST",
        body: payload,
        headers: {
          "x-webhook-signature": signature,
          "content-type": "application/json",
        },
      });

      const res1 = await webhookHandler(req1, {
        params: Promise.resolve({ provider: "test" }),
      });

      expect(res1.status).toBe(200);
      const body1 = (await res1.json()) as { status: string; eventId: string };
      expect(body1.status).toBe("ok");
      expect(body1.eventId).toBeDefined();

      // Check event inserted in DB
      const [storedEvent] = await db
        .select()
        .from(webhookEventsTable)
        .where(eq(webhookEventsTable.externalId, externalId));

      expect(storedEvent).toBeDefined();
      expect(storedEvent?.provider).toBe("test");
      expect(storedEvent?.status).toBe("pending");

      // Check job enqueued in DB
      const enqueuedJobs = await db
        .select()
        .from(jobsTable)
        .where(eq(jobsTable.name, PROCESS_WEBHOOK_JOB));

      const matchingJob = enqueuedJobs.find((j) => {
        const p = j.payload as { eventId?: string };
        return p?.eventId === body1.eventId;
      });
      expect(matchingJob).toBeDefined();

      // 2. Duplicate delivery replay
      const req2 = new NextRequest("http://localhost:3000/api/webhooks/test", {
        method: "POST",
        body: payload,
        headers: {
          "x-webhook-signature": signature,
          "content-type": "application/json",
        },
      });

      const res2 = await webhookHandler(req2, {
        params: Promise.resolve({ provider: "test" }),
      });

      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as {
        status: string;
        duplicate?: boolean;
      };
      expect(body2.duplicate).toBe(true);

      // Verify no duplicate row was created in DB
      const allMatching = await db
        .select()
        .from(webhookEventsTable)
        .where(eq(webhookEventsTable.externalId, externalId));

      expect(allMatching.length).toBe(1);
    });
  });
});
