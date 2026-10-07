import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import type { Tx } from "@/db/tx";
import { lessonsTable, modulesTable } from "@/modules/content/schema";
import {
  type LessonProgress,
  lessonProgressTable,
  type SectionCompletion,
  sectionCompletionsTable,
} from "./schema";

/**
 * Gets progress record for a single lesson.
 */
export async function getLessonProgress(
  enrollmentId: string,
  lessonId: string,
  tx: Tx | typeof db = db,
): Promise<LessonProgress | null> {
  const rows = await tx
    .select()
    .from(lessonProgressTable)
    .where(
      and(
        eq(lessonProgressTable.enrollmentId, enrollmentId),
        eq(lessonProgressTable.lessonId, lessonId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Computes overall completion status and progress summary for a student in a section.
 */
export async function getSectionProgressSummary(
  enrollmentId: string,
  sectionId: string,
  tx: Tx | typeof db = db,
): Promise<{
  totalLessons: number;
  completedLessons: number;
  overallProgressPct: number;
  isCompleted: boolean;
  completionRecord: SectionCompletion | null;
}> {
  // 1. Fetch published lessons in section
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
  if (moduleIds.length === 0) {
    return {
      totalLessons: 0,
      completedLessons: 0,
      overallProgressPct: 0,
      isCompleted: false,
      completionRecord: null,
    };
  }

  const publishedLessons = await tx
    .select({ id: lessonsTable.id })
    .from(lessonsTable)
    .where(
      and(
        inArray(lessonsTable.moduleId, moduleIds),
        eq(lessonsTable.status, "published"),
      ),
    );

  const totalLessons = publishedLessons.length;
  if (totalLessons === 0) {
    return {
      totalLessons: 0,
      completedLessons: 0,
      overallProgressPct: 0,
      isCompleted: false,
      completionRecord: null,
    };
  }

  // 2. Fetch completed lessons for this enrollment
  const lessonIds = publishedLessons.map((l) => l.id);
  const completedProgress = await tx
    .select()
    .from(lessonProgressTable)
    .where(
      and(
        eq(lessonProgressTable.enrollmentId, enrollmentId),
        inArray(lessonProgressTable.lessonId, lessonIds),
        eq(lessonProgressTable.status, "completed"),
      ),
    );

  const completedLessons = completedProgress.length;
  const overallProgressPct = Math.round(
    (completedLessons / totalLessons) * 100,
  );

  // 3. Fetch section completion record
  const [completionRecord] = await tx
    .select()
    .from(sectionCompletionsTable)
    .where(eq(sectionCompletionsTable.enrollmentId, enrollmentId))
    .limit(1);

  return {
    totalLessons,
    completedLessons,
    overallProgressPct,
    isCompleted: Boolean(completionRecord),
    completionRecord: completionRecord ?? null,
  };
}
