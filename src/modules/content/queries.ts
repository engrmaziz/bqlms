import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import type { Tx } from "@/db/tx";
import type { Actor } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import {
  sectionInstructorsTable,
  sectionsTable,
  termsTable,
} from "@/modules/academics/schema";
import { enrollmentsTable } from "@/modules/enrollment/schema";
import { filesTable } from "@/modules/files/schema";
import { lessonProgressTable } from "@/modules/progress/schema";
import { settingsTable } from "@/modules/settings/schema";
import { evaluateAccess } from "./drip";
import {
  dripOverridesTable,
  type Lesson,
  type LessonType,
  lessonsTable,
  type Module,
  modulesTable,
  type SyllabusVersion,
  syllabusVersionsTable,
} from "./schema";

export interface StudentCurriculumLesson {
  id: string;
  moduleId: string;
  type: LessonType;
  title: string;
  position: string;
  estMinutes: number;
  isLocked: boolean;
  lockReason?: string | undefined;
  unlocksAt?: Date | undefined;
  status: "draft" | "published";
  progressStatus: "not_started" | "in_progress" | "completed";
  progressPct: number;
}

export interface StudentCurriculumModule {
  id: string;
  title: string;
  position: string;
  status: "draft" | "published";
  lessons: StudentCurriculumLesson[];
}

export interface FacultyCurriculumLesson extends Lesson {
  prerequisiteLessonTitles?: string[];
}

export interface FacultyCurriculumModule extends Module {
  lessons: FacultyCurriculumLesson[];
}

export type SectionCurriculumResult =
  | {
      isInstructor: true;
      collegeTimezone: string;
      section: typeof sectionsTable.$inferSelect;
      term: typeof termsTable.$inferSelect;
      enrollment: null;
      modules: FacultyCurriculumModule[];
    }
  | {
      isInstructor: false;
      collegeTimezone: string;
      section: typeof sectionsTable.$inferSelect;
      term: typeof termsTable.$inferSelect;
      enrollment: typeof enrollmentsTable.$inferSelect | null;
      modules: StudentCurriculumModule[];
    };

/**
 * Retrieves the full curriculum tree for a section.
 * - For instructors (unless viewAsStudent is true), returns all modules & lessons (draft + published).
 * - For students (or viewAsStudent), returns published content with server-evaluated drip rules and locked stubs.
 */
export async function getSectionCurriculum(
  sectionId: string,
  actor: Actor,
  options: { viewAsStudent?: boolean } = {},
  tx: Tx | typeof db = db,
): Promise<SectionCurriculumResult> {
  // 1. Fetch section and term details
  const sectionRows = await tx
    .select({
      section: sectionsTable,
      term: termsTable,
    })
    .from(sectionsTable)
    .innerJoin(termsTable, eq(sectionsTable.termId, termsTable.id))
    .where(eq(sectionsTable.id, sectionId))
    .limit(1);

  const sectionData = sectionRows[0];
  if (!sectionData) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Section not found.",
    });
  }

  // 2. Fetch college settings for timezone
  const settingsRows = await tx.select().from(settingsTable).limit(1);
  const collegeTimezone = settingsRows[0]?.timezone || "UTC";

  // 3. Determine if actor is instructor for this section
  const instructorRows = await tx
    .select()
    .from(sectionInstructorsTable)
    .where(
      and(
        eq(sectionInstructorsTable.sectionId, sectionId),
        eq(sectionInstructorsTable.userId, actor.userId),
      ),
    )
    .limit(1);

  const isInstructor =
    (instructorRows.length > 0 ||
      actor.roles.includes("admin") ||
      actor.roles.includes("super_admin")) &&
    !options.viewAsStudent;

  // 4. Fetch modules
  const allModules = await tx
    .select()
    .from(modulesTable)
    .where(eq(modulesTable.sectionId, sectionId))
    .orderBy(modulesTable.position);

  // 5. Fetch lessons
  const moduleIds = allModules.map((m) => m.id);
  const allLessons =
    moduleIds.length > 0
      ? await tx
          .select()
          .from(lessonsTable)
          .where(inArray(lessonsTable.moduleId, moduleIds))
          .orderBy(lessonsTable.position)
      : [];

  // Instructors (builder view) see everything without locked stubs
  if (isInstructor) {
    const modulesWithLessons: FacultyCurriculumModule[] = allModules.map(
      (m) => ({
        ...m,
        lessons: allLessons.filter((l) => l.moduleId === m.id),
      }),
    );
    return {
      isInstructor: true,
      collegeTimezone,
      section: sectionData.section,
      term: sectionData.term,
      enrollment: null,
      modules: modulesWithLessons,
    };
  }

  // Student / View As Student flow:
  // 6. Fetch student enrollment
  const enrollmentRows = await tx
    .select()
    .from(enrollmentsTable)
    .where(
      and(
        eq(enrollmentsTable.sectionId, sectionId),
        eq(enrollmentsTable.studentId, actor.userId),
      ),
    )
    .limit(1);

  const enrollment = enrollmentRows[0];

  // 7. Fetch student's progress for lessons in this section
  const progressRows = enrollment
    ? await tx
        .select()
        .from(lessonProgressTable)
        .where(eq(lessonProgressTable.enrollmentId, enrollment.id))
    : [];

  const progressByLessonId = new Map(progressRows.map((p) => [p.lessonId, p]));
  const completedLessonIds = new Set(
    progressRows.filter((p) => p.status === "completed").map((p) => p.lessonId),
  );

  // 8. Fetch student drip overrides
  const overrides = await tx
    .select()
    .from(dripOverridesTable)
    .where(eq(dripOverridesTable.studentId, actor.userId));
  const overrideMap = new Map(overrides.map((o) => [o.targetId, o]));

  const currentTime = new Date();

  // 9. Process modules and lessons for student view
  const visibleModules = allModules.filter((m) => m.status === "published");
  const processedModules: StudentCurriculumModule[] = [];

  for (const mod of visibleModules) {
    const publishedLessons = allLessons.filter(
      (l) => l.moduleId === mod.id && l.status === "published",
    );

    const processedLessons: StudentCurriculumLesson[] = [];

    for (const lesson of publishedLessons) {
      const override = overrideMap.get(lesson.id);
      const access = evaluateAccess(lesson.dripRules, {
        currentTime,
        timezone: collegeTimezone,
        isInstructor: false,
        overrideUnlockedAt: override ? override.unlockedAt : null,
        enrollmentDate: enrollment ? enrollment.createdAt : null,
        termStartDate: sectionData.term.startsOn,
        completedLessonIds,
      });

      const prog = progressByLessonId.get(lesson.id);

      processedLessons.push({
        id: lesson.id,
        moduleId: lesson.moduleId,
        type: lesson.type,
        title: lesson.title,
        position: lesson.position,
        estMinutes: lesson.estMinutes,
        isLocked: !access.unlocked,
        lockReason: access.reason,
        unlocksAt: access.unlocksAt,
        status: lesson.status,
        progressStatus: prog?.status ?? "not_started",
        progressPct: prog?.progressPct ?? 0,
      });
    }

    processedModules.push({
      id: mod.id,
      title: mod.title,
      position: mod.position,
      status: mod.status,
      lessons: processedLessons,
    });
  }

  return {
    isInstructor: false,
    collegeTimezone,
    section: sectionData.section,
    term: sectionData.term,
    enrollment: enrollment ?? null,
    modules: processedModules,
  };
}

/**
 * Retrieves a single lesson for student consumption.
 * STRICT ENFORCEMENT: If locked, returns a stub with no body, no file ID, and no video metadata!
 */
export async function getLessonForStudent(
  lessonId: string,
  actor: Actor,
  tx: Tx | typeof db = db,
) {
  // 1. Fetch lesson and parent module/section
  const rows = await tx
    .select({
      lesson: lessonsTable,
      module: modulesTable,
      section: sectionsTable,
      term: termsTable,
    })
    .from(lessonsTable)
    .innerJoin(modulesTable, eq(lessonsTable.moduleId, modulesTable.id))
    .innerJoin(sectionsTable, eq(modulesTable.sectionId, sectionsTable.id))
    .innerJoin(termsTable, eq(sectionsTable.termId, termsTable.id))
    .where(eq(lessonsTable.id, lessonId))
    .limit(1);

  const data = rows[0];
  if (!data) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Lesson not found.",
    });
  }

  // 2. Fetch college timezone
  const settingsRows = await tx.select().from(settingsTable).limit(1);
  const collegeTimezone = settingsRows[0]?.timezone || "UTC";

  // 3. Check enrollment
  const enrollmentRows = await tx
    .select()
    .from(enrollmentsTable)
    .where(
      and(
        eq(enrollmentsTable.sectionId, data.section.id),
        eq(enrollmentsTable.studentId, actor.userId),
      ),
    )
    .limit(1);

  const enrollment = enrollmentRows[0];
  if (!enrollment) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You are not enrolled in this section.",
    });
  }

  // 4. Fetch completed lessons for prerequisites
  const progressRows = await tx
    .select()
    .from(lessonProgressTable)
    .where(eq(lessonProgressTable.enrollmentId, enrollment.id));

  const completedLessonIds = new Set(
    progressRows.filter((p) => p.status === "completed").map((p) => p.lessonId),
  );

  const currentLessonProgress = progressRows.find(
    (p) => p.lessonId === lessonId,
  );

  // 5. Check override
  const overrideRows = await tx
    .select()
    .from(dripOverridesTable)
    .where(
      and(
        eq(dripOverridesTable.studentId, actor.userId),
        eq(dripOverridesTable.targetId, lessonId),
      ),
    )
    .limit(1);

  const override = overrideRows[0];

  // 6. Evaluate access
  const access = evaluateAccess(data.lesson.dripRules, {
    currentTime: new Date(),
    timezone: collegeTimezone,
    isInstructor: false,
    overrideUnlockedAt: override ? override.unlockedAt : null,
    enrollmentDate: enrollment.createdAt,
    termStartDate: data.term.startsOn,
    completedLessonIds,
  });

  // If LOCKED: Return safe stub with NO private content
  if (!access.unlocked) {
    return {
      id: data.lesson.id,
      moduleId: data.lesson.moduleId,
      title: data.lesson.title,
      type: data.lesson.type,
      position: data.lesson.position,
      estMinutes: data.lesson.estMinutes,
      isLocked: true,
      reason: access.reason ?? "Content is currently locked.",
      unlocksAt: access.unlocksAt,
      body: null,
      fileId: null,
      file: null,
      video: null,
      progress: currentLessonProgress ?? null,
      section: data.section,
      module: data.module,
    };
  }

  // If UNLOCKED: Fetch file info if fileId exists
  let attachedFile = null;
  if (data.lesson.fileId) {
    const fileRows = await tx
      .select()
      .from(filesTable)
      .where(
        and(
          eq(filesTable.id, data.lesson.fileId),
          isNull(filesTable.deletedAt),
        ),
      )
      .limit(1);
    attachedFile = fileRows[0] ?? null;
  }

  return {
    id: data.lesson.id,
    moduleId: data.lesson.moduleId,
    title: data.lesson.title,
    type: data.lesson.type,
    position: data.lesson.position,
    estMinutes: data.lesson.estMinutes,
    isLocked: false,
    reason: undefined,
    unlocksAt: undefined,
    body: data.lesson.body,
    fileId: data.lesson.fileId,
    file: attachedFile,
    video: data.lesson.video,
    progress: currentLessonProgress ?? null,
    section: data.section,
    module: data.module,
  };
}

/**
 * Checks whether an actor can download a file attached to a lesson.
 * Enforces drip lock: if the lesson is locked for this student, returns false!
 */
export async function canAccessLessonFile(
  fileId: string,
  actor: Actor,
  tx: Tx | typeof db = db,
): Promise<boolean> {
  // If instructor or admin, always allowed
  if (
    actor.roles.some((r) => ["admin", "super_admin", "faculty"].includes(r))
  ) {
    return true;
  }

  // Find lessons referencing this file
  const lessons = await tx
    .select({
      id: lessonsTable.id,
    })
    .from(lessonsTable)
    .where(eq(lessonsTable.fileId, fileId));

  if (lessons.length === 0) {
    return true; // Not a lesson-attached file, regular policy applies
  }

  // Check each lesson: if at least one is unlocked for the student, file is accessible
  for (const { id: lessonId } of lessons) {
    try {
      const lesson = await getLessonForStudent(lessonId, actor, tx);
      if (!lesson.isLocked) {
        return true;
      }
    } catch {
      // Not enrolled or error
    }
  }

  return false;
}

/**
 * Retrieves the latest published syllabus for a section.
 */
export async function getLatestSyllabus(
  sectionId: string,
  tx: Tx | typeof db = db,
): Promise<SyllabusVersion | null> {
  const rows = await tx
    .select()
    .from(syllabusVersionsTable)
    .where(eq(syllabusVersionsTable.sectionId, sectionId))
    .orderBy(desc(syllabusVersionsTable.version))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Retrieves all published syllabus versions for a section.
 */
export async function getSyllabusHistory(
  sectionId: string,
  tx: Tx | typeof db = db,
): Promise<SyllabusVersion[]> {
  return tx
    .select()
    .from(syllabusVersionsTable)
    .where(eq(syllabusVersionsTable.sectionId, sectionId))
    .orderBy(desc(syllabusVersionsTable.version));
}
