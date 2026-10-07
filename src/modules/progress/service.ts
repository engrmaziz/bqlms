import { and, eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Tx } from "@/db/tx";
import type { Actor } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { lessonsTable, modulesTable } from "@/modules/content/schema";
import { enrollmentsTable } from "@/modules/enrollment/schema";
import { enqueue } from "@/modules/jobs";
import { calculateVideoProgress, type Interval } from "./intervals";
import {
  type LessonProgress,
  lessonProgressTable,
  type ProgressStatus,
  sectionCompletionsTable,
} from "./schema";

export interface HeartbeatPayload {
  lessonId: string;
  currentPositionS?: number | undefined;
  intervals?: [number, number][] | undefined;
  dwellSeconds?: number | undefined;
  isEndReached?: boolean | undefined;
  isBeacon?: boolean | undefined;
}

/**
 * Checks whether all published lessons in a section have been completed by the student.
 * If so, records section completion exactly once and enqueues certificate check.
 */
export async function checkAndRecordSectionCompletion(
  tx: Tx,
  enrollmentId: string,
  sectionId: string,
): Promise<boolean> {
  // 1. Get all published modules in this section
  const modules = await tx
    .select({ id: modulesTable.id })
    .from(modulesTable)
    .where(
      and(
        eq(modulesTable.sectionId, sectionId),
        eq(modulesTable.status, "published"),
      ),
    );

  const moduleIds = modules.map((m) => m.id);
  if (moduleIds.length === 0) return false;

  // 2. Get all published lessons in these modules
  const publishedLessons = await tx
    .select({ id: lessonsTable.id })
    .from(lessonsTable)
    .where(
      and(
        inArray(lessonsTable.moduleId, moduleIds),
        eq(lessonsTable.status, "published"),
      ),
    );

  if (publishedLessons.length === 0) return false;

  const totalLessonIds = new Set(publishedLessons.map((l) => l.id));

  // 3. Get all completed lessons for this enrollment
  const completedProgress = await tx
    .select({ lessonId: lessonProgressTable.lessonId })
    .from(lessonProgressTable)
    .where(
      and(
        eq(lessonProgressTable.enrollmentId, enrollmentId),
        eq(lessonProgressTable.status, "completed"),
      ),
    );

  const completedLessonIds = new Set(completedProgress.map((p) => p.lessonId));

  // Check if every published lesson is completed
  for (const id of totalLessonIds) {
    if (!completedLessonIds.has(id)) {
      return false;
    }
  }

  // All completed! Insert section completion record with unique guard
  const existing = await tx
    .select()
    .from(sectionCompletionsTable)
    .where(eq(sectionCompletionsTable.enrollmentId, enrollmentId))
    .limit(1);

  if (existing.length === 0) {
    await tx
      .insert(sectionCompletionsTable)
      .values({
        id: uuidv7(),
        enrollmentId,
        completedAt: new Date(),
      })
      .onConflictDoNothing();

    // Enqueue certificate verification job (consumed in Prompt 17)
    await enqueue(
      tx,
      "certificate:check",
      { enrollmentId },
      { dedupeKey: `cert-check:${enrollmentId}` },
    );

    logger.info(
      { enrollmentId, sectionId },
      "Section fully completed; certificate check enqueued",
    );
  }

  return true;
}

/**
 * Records student progress heartbeat for an active lesson.
 * Enforces monotonic progress (progress percentage and watched coverage never decrease).
 */
export async function recordHeartbeat(
  tx: Tx,
  actor: Actor,
  payload: HeartbeatPayload,
): Promise<{
  progress: LessonProgress;
  sectionCompleted: boolean;
}> {
  // 1. Fetch lesson and parent section
  const lessonRows = await tx
    .select({
      lesson: lessonsTable,
      sectionId: modulesTable.sectionId,
    })
    .from(lessonsTable)
    .innerJoin(modulesTable, eq(lessonsTable.moduleId, modulesTable.id))
    .where(eq(lessonsTable.id, payload.lessonId))
    .limit(1);

  const lessonData = lessonRows[0];
  if (!lessonData) {
    throw new AppError({ code: "NOT_FOUND", message: "Lesson not found." });
  }

  // 2. Fetch student's enrollment
  const enrollmentRows = await tx
    .select()
    .from(enrollmentsTable)
    .where(
      and(
        eq(enrollmentsTable.sectionId, lessonData.sectionId),
        eq(enrollmentsTable.studentId, actor.userId),
        eq(enrollmentsTable.status, "enrolled"),
      ),
    )
    .limit(1);

  const enrollment = enrollmentRows[0];
  if (!enrollment) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You are not actively enrolled in this section.",
    });
  }

  // 3. Fetch existing progress record
  const existingRows = await tx
    .select()
    .from(lessonProgressTable)
    .where(
      and(
        eq(lessonProgressTable.enrollmentId, enrollment.id),
        eq(lessonProgressTable.lessonId, payload.lessonId),
      ),
    )
    .limit(1);

  const existing = existingRows[0];
  const existingWatched = (existing?.watched ?? []) as Interval[];
  let newStatus: ProgressStatus = existing?.status ?? "in_progress";
  let newProgressPct = existing?.progressPct ?? 0;
  let newWatched = existingWatched;
  let newLastPosition = existing?.lastPositionS ?? 0;
  let completedAt = existing?.completedAt ?? null;

  if (payload.currentPositionS !== undefined) {
    newLastPosition = Math.max(0, Math.floor(payload.currentPositionS));
  }

  const lessonType = lessonData.lesson.type;

  switch (lessonType) {
    case "video": {
      const durationSeconds =
        lessonData.lesson.video?.durationSeconds ||
        (lessonData.lesson.estMinutes || 5) * 60;

      const incomingIntervals = (payload.intervals || []) as Interval[];
      const videoResult = calculateVideoProgress(
        durationSeconds,
        existingWatched,
        incomingIntervals,
      );

      newWatched = videoResult.merged;
      // Monotonic progress: never decreases
      newProgressPct = Math.max(
        existing?.progressPct ?? 0,
        videoResult.progressPct,
      );

      if (videoResult.isCompleted && newStatus !== "completed") {
        newStatus = "completed";
        completedAt = new Date();
      } else if (newStatus === "not_started" && newProgressPct > 0) {
        newStatus = "in_progress";
      }
      break;
    }

    case "rich_text": {
      // Completed if student reached end and dwelt for minimum duration (e.g. at least 10s or estMinutes * 6s)
      const minDwell = Math.min(30, (lessonData.lesson.estMinutes || 1) * 10);
      const dwell = payload.dwellSeconds ?? 0;
      const endReached = payload.isEndReached ?? false;

      if (endReached && dwell >= minDwell) {
        newProgressPct = 100;
        newStatus = "completed";
        completedAt = new Date();
      } else {
        const estimatedProgress = Math.min(
          95,
          Math.floor((dwell / minDwell) * 100),
        );
        newProgressPct = Math.max(
          existing?.progressPct ?? 0,
          estimatedProgress,
        );
        if (newStatus === "not_started") {
          newStatus = "in_progress";
        }
      }
      break;
    }

    case "file": {
      // Opening/viewing the file marks it as completed
      newProgressPct = 100;
      newStatus = "completed";
      completedAt = new Date();
      break;
    }

    default: {
      if (payload.isEndReached) {
        newProgressPct = 100;
        newStatus = "completed";
        completedAt = new Date();
      }
      break;
    }
  }

  // 4. Upsert lesson progress row
  let savedProgress: LessonProgress;
  if (!existing) {
    const [inserted] = await tx
      .insert(lessonProgressTable)
      .values({
        id: uuidv7(),
        enrollmentId: enrollment.id,
        lessonId: payload.lessonId,
        status: newStatus,
        progressPct: newProgressPct,
        lastPositionS: newLastPosition,
        watched: newWatched,
        completedAt,
      })
      .returning();
    if (!inserted) {
      throw new AppError({
        code: "INTERNAL",
        message: "Failed to insert lesson progress",
      });
    }
    savedProgress = inserted;
  } else {
    const [updated] = await tx
      .update(lessonProgressTable)
      .set({
        status: newStatus,
        progressPct: newProgressPct,
        lastPositionS: newLastPosition,
        watched: newWatched,
        completedAt,
        updatedAt: new Date(),
      })
      .where(eq(lessonProgressTable.id, existing.id))
      .returning();
    if (!updated) {
      throw new AppError({
        code: "INTERNAL",
        message: "Failed to update lesson progress",
      });
    }
    savedProgress = updated;
  }

  // 5. Check if entire section is completed
  let sectionCompleted = false;
  if (newStatus === "completed") {
    sectionCompleted = await checkAndRecordSectionCompletion(
      tx,
      enrollment.id,
      lessonData.sectionId,
    );
  }

  return {
    progress: savedProgress,
    sectionCompleted,
  };
}
