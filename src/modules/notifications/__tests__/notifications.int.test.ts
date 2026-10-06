import { eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { withTx } from "@/db/tx";
import { env } from "@/lib/env";
import { fakeEmailProvider } from "@/lib/providers/email";
import { createUserWithProfile } from "@/modules/identity";
import { drainJobs } from "@/modules/jobs";
import {
  countEmailsSentToday,
  notificationDeliveriesTable,
  notificationsTable,
  notify,
  processDailyDigest,
} from "@/modules/notifications";

describe("Notifications Module Integration Tests", () => {
  let testUserId: string;
  let testUserEmail: string;

  beforeAll(async () => {
    // Clean deliveries and notifications for fresh daily cap test run
    await db.execute(sql`
      DELETE FROM lms.notification_deliveries;
      DELETE FROM lms.notifications;
    `);

    testUserEmail = `notify_tester_${Date.now()}@college.edu`;
    const { user } = await createUserWithProfile({
      name: "Notification Tester",
      email: testUserEmail,
      password: "TestPassword123!",
      roles: ["student"],
      status: "active",
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    fakeEmailProvider.clear();
  });

  it("proves ten digest-class notifications for one user produce one email", async () => {
    fakeEmailProvider.clear();

    // 1. Enqueue 10 digest-class notifications for testUser
    for (let i = 1; i <= 10; i++) {
      await withTx(async (tx) => {
        await notify(tx, {
          recipient: testUserId,
          category: "announcement",
          data: {
            title: `Campus Announcement #${i}`,
            body: `Details for announcement #${i}`,
            link: `/announcements/${i}`,
          },
        });
      });
    }

    // Verify all 10 were created with kind = digest and status = queued
    const queuedDeliveries = await db
      .select()
      .from(notificationDeliveriesTable)
      .innerJoin(
        notificationsTable,
        eq(notificationDeliveriesTable.notificationId, notificationsTable.id),
      )
      .where(eq(notificationsTable.userId, testUserId));

    const digestDeliveries = queuedDeliveries.filter(
      (d) =>
        d.notification_deliveries.kind === "digest" &&
        d.notification_deliveries.status === "queued",
    );
    expect(digestDeliveries.length).toBe(10);

    // 2. Process daily digest
    const digestResult = await processDailyDigest();
    expect(digestResult.usersProcessed).toBeGreaterThanOrEqual(1);
    expect(digestResult.emailsSent).toBeGreaterThanOrEqual(1);

    // 3. Verify exactly one email was sent to this user with all announcements
    const userEmails = fakeEmailProvider.sentEmails.filter(
      (m) => m.to === testUserEmail,
    );
    expect(userEmails.length).toBe(1);
    expect(userEmails[0]?.subject).toContain("Daily Digest: 10 new updates");
    expect(userEmails[0]?.text).toContain("Campus Announcement #1");
    expect(userEmails[0]?.text).toContain("Campus Announcement #10");

    // Deliveries should now be marked as sent
    const updatedDeliveries = await db
      .select()
      .from(notificationDeliveriesTable)
      .innerJoin(
        notificationsTable,
        eq(notificationDeliveriesTable.notificationId, notificationsTable.id),
      )
      .where(eq(notificationsTable.userId, testUserId));

    const sentDigestDeliveries = updatedDeliveries.filter(
      (d) =>
        d.notification_deliveries.kind === "digest" &&
        d.notification_deliveries.status === "sent",
    );
    expect(sentDigestDeliveries.length).toBe(10);
  });

  it("proves an immediate-class notification sends within the next tick", async () => {
    fakeEmailProvider.clear();

    // 1. Send an immediate-class notification (e.g. category 'security')
    const result = await withTx(async (tx) => {
      return notify(tx, {
        recipient: testUserId,
        category: "security",
        data: {
          title: "New login from unknown device",
          body: "A new session was initiated from IP 192.168.1.50",
          link: "/settings/security",
        },
      });
    });

    expect(result.delivery).toBeDefined();
    expect(result.delivery?.kind).toBe("immediate");
    expect(result.delivery?.status).toBe("queued");

    // Before draining jobs, no email has been sent yet
    const beforeDrain = fakeEmailProvider.sentEmails.filter(
      (m) => m.to === testUserEmail,
    );
    expect(beforeDrain.length).toBe(0);

    // 2. Drain jobs (simulating the per-minute tick)
    const drainResult = await drainJobs(5);
    expect(drainResult.processed).toBeGreaterThanOrEqual(1);

    // 3. Verify email was sent immediately within the tick
    const afterDrain = fakeEmailProvider.sentEmails.filter(
      (m) => m.to === testUserEmail,
    );
    expect(afterDrain.length).toBe(1);
    expect(afterDrain[0]?.subject).toContain("New login from unknown device");
    expect(afterDrain[0]?.text).toContain("IP 192.168.1.50");

    // Delivery row status should now be 'sent'
    if (result.delivery) {
      const [updated] = await db
        .select()
        .from(notificationDeliveriesTable)
        .where(eq(notificationDeliveriesTable.id, result.delivery.id));
      expect(updated?.status).toBe("sent");
    }
  });

  it("proves the 4th immediate email of the day rolls into the digest", async () => {
    // Create a fresh user for this test to avoid prior counts
    const freshEmail = `user_limit_${uuidv7()}@college.edu`;
    const { user: userLimit } = await createUserWithProfile({
      name: "Per Day Limit Tester",
      email: freshEmail,
      password: "TestPassword123!",
      roles: ["student"],
      status: "active",
    });

    // Send 3 non-security immediate notifications ('deadline')
    for (let i = 1; i <= 3; i++) {
      const res = await withTx(async (tx) => {
        return notify(tx, {
          recipient: userLimit.id,
          category: "deadline",
          data: {
            title: `Urgent Assignment ${i}`,
            body: `Due in 1 hour #${i}`,
          },
        });
      });

      expect(res.delivery).toBeDefined();
      expect(res.delivery?.kind).toBe("immediate");
    }

    // Send the 4th immediate notification on the same day
    const fourth = await withTx(async (tx) => {
      return notify(tx, {
        recipient: userLimit.id,
        category: "deadline",
        data: {
          title: "Urgent Assignment 4",
          body: "Due in 30 minutes #4",
        },
      });
    });

    expect(fourth.delivery).toBeDefined();
    // Must roll into the daily digest!
    expect(fourth.delivery?.kind).toBe("digest");
    expect(fourth.delivery?.status).toBe("queued");
  });

  it("proves the global cap defers the (cap+1)th message but still sends a security email from the reserve", async () => {
    fakeEmailProvider.clear();

    const capEmail = `cap_tester_${uuidv7()}@college.edu`;
    const { user: capUser } = await createUserWithProfile({
      name: "Cap Tester",
      email: capEmail,
      password: "TestPassword123!",
      roles: ["student"],
      status: "active",
    });

    // Create a filler user to hold dummy sent deliveries (isolating capUser's per-user limit)
    const fillerEmail = `filler_${uuidv7()}@college.edu`;
    const { user: fillerUser } = await createUserWithProfile({
      name: "Filler User",
      email: fillerEmail,
      password: "TestPassword123!",
      roles: ["student"],
      status: "active",
    });

    const dummyNotif = await withTx(async (tx) => {
      return notify(tx, {
        recipient: fillerUser.id,
        category: "reminder",
        data: { title: "Dummy base" },
      });
    });

    // Determine current sent count today
    const currentSent = await countEmailsSentToday();
    const hardCap = env.EMAIL_DAILY_CAP;
    const regularCap = Math.max(0, hardCap - 30);
    const neededToFill = regularCap - currentSent;

    if (neededToFill > 0) {
      await db.execute(sql`
        INSERT INTO lms.notification_deliveries (id, notification_id, channel, kind, status, dedupe_key, sent_at)
        SELECT gen_random_uuid(), ${dummyNotif.notification.id}, 'email'::lms.notification_channel, 'immediate'::lms.notification_delivery_kind, 'sent'::lms.notification_delivery_status, gen_random_uuid()::text, now()
        FROM generate_series(1, ${neededToFill})
      `);
    }

    // Verify sentToday has reached regularCap
    const sentAfterFill = await countEmailsSentToday();
    expect(sentAfterFill).toBeGreaterThanOrEqual(regularCap);
    expect(sentAfterFill).toBeLessThan(hardCap);

    // 1. Attempt to send a non-security immediate message (e.g., 'exam')
    // Should be enqueued, but during drain it must be deferred due to regular cap
    const nonSecurityResult = await withTx(async (tx) => {
      return notify(tx, {
        recipient: capUser.id,
        category: "exam",
        data: {
          title: "Exam Tomorrow",
          body: "Please arrive at 9 AM",
        },
      });
    });

    expect(nonSecurityResult.delivery).toBeDefined();
    expect(nonSecurityResult.delivery?.kind).toBe("immediate");

    // 2. Attempt to send a security message (e.g., 'security')
    // Should be enqueued and must NOT be deferred (uses 30-message reserve)
    const securityResult = await withTx(async (tx) => {
      return notify(tx, {
        recipient: capUser.id,
        category: "security",
        data: {
          title: "Security: Password Reset",
          body: "Use this link to reset your password",
        },
      });
    });

    expect(securityResult.delivery).toBeDefined();
    expect(securityResult.delivery?.kind).toBe("immediate");

    // 3. Drain jobs to process both deliveries
    await drainJobs(10);

    // 4. Verify non-security delivery was DEFERRED
    if (nonSecurityResult.delivery) {
      const [nonSecRow] = await db
        .select()
        .from(notificationDeliveriesTable)
        .where(
          eq(notificationDeliveriesTable.id, nonSecurityResult.delivery.id),
        );

      expect(nonSecRow?.status).toBe("deferred");
      expect(nonSecRow?.error).toContain("Daily sending cap reached");
    }

    // 5. Verify security delivery was SENT
    if (securityResult.delivery) {
      const [secRow] = await db
        .select()
        .from(notificationDeliveriesTable)
        .where(eq(notificationDeliveriesTable.id, securityResult.delivery.id));

      expect(secRow?.status).toBe("sent");
    }

    // Verify fakeEmailProvider sent the security email but not the non-security one
    const sentToCapUser = fakeEmailProvider.sentEmails.filter(
      (m) => m.to === capEmail,
    );
    expect(sentToCapUser.length).toBe(1);
    expect(sentToCapUser[0]?.subject).toContain("Security: Password Reset");
  });
});
