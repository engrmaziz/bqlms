import { eq } from "drizzle-orm";
import { z } from "zod";
import { type Tx, withTx } from "@/db/tx";
import type { Actor } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { lessonsTable } from "@/modules/content/schema";
import { registerJob } from "@/modules/jobs";
import { notify } from "@/modules/notifications";
import { getLessonForStudent } from "./queries";

export const DRIP_UNLOCK_NOTIFICATION_JOB = "content:notify-drip-unlock";

export interface DripUnlockNotificationPayload {
  lessonId: string;
  studentId: string;
}

/**
 * Executes a time-based drip unlock notification.
 * Crucial invariant: Re-evaluates access before notifying the student!
 */
export async function runDripUnlockNotificationJob(
  tx: Tx,
  payload: DripUnlockNotificationPayload,
): Promise<void> {
  logger.info(payload, "Running drip unlock notification job");

  const [lesson] = await tx
    .select({ title: lessonsTable.title })
    .from(lessonsTable)
    .where(eq(lessonsTable.id, payload.lessonId))
    .limit(1);

  if (!lesson) {
    logger.warn(payload, "Lesson not found for drip unlock notification");
    return;
  }

  // Re-evaluate access for the student
  try {
    const studentActor: Actor = {
      userId: payload.studentId,
      email: `${payload.studentId}@college.test`,
      name: "Student",
      roles: ["student"],
      status: "active",
      twoFactorEnabled: false,
      profile: {
        userId: payload.studentId,
        roles: ["student"],
        status: "active",
        studentNumber: null,
        employeeId: null,
        phone: null,
        createdAt: new Date(),
      },
    };

    const studentView = await getLessonForStudent(
      payload.lessonId,
      studentActor,
      tx,
    );

    // If still locked (e.g. prerequisite not met), do not notify
    if (studentView.isLocked) {
      logger.info(
        payload,
        "Lesson still locked upon re-evaluation; skipping unlock notification",
      );
      return;
    }

    // Send notification
    await notify(tx, {
      recipient: payload.studentId,
      category: "content",
      template: "lesson_unlocked",
      data: {
        title: "Lesson Unlocked",
        body: `Your lesson "${lesson.title}" is now available.`,
        lessonId: payload.lessonId,
        lessonTitle: lesson.title,
      },
      dedupeKey: `unlock:${payload.studentId}:${payload.lessonId}`,
    });

    logger.info(payload, "Drip unlock notification dispatched to student");
  } catch (err) {
    logger.error(
      { err, ...payload },
      "Failed to evaluate drip access or notify student",
    );
  }
}

registerJob(DRIP_UNLOCK_NOTIFICATION_JOB, {
  schema: z.object({
    lessonId: z.string().uuid(),
    studentId: z.string(),
  }),
  handler: async (payload, _ctx) => {
    await withTx(async (tx) => {
      await runDripUnlockNotificationJob(
        tx,
        payload as DripUnlockNotificationPayload,
      );
    });
  },
  maxAttempts: 3,
});
