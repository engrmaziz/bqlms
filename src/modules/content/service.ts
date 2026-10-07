import { desc, eq, inArray } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { uuidv7 } from "uuidv7";
import type { Tx } from "@/db/tx";
import type { Actor } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { sectionsTable } from "@/modules/academics/schema";
import { enqueue } from "@/modules/jobs";
import { validatePrerequisiteGraph } from "./drip";
import { canManageSectionContent, canPublishSectionContent } from "./policy";
import {
  type DripOverride,
  type DripRule,
  type DripTargetType,
  dripOverridesTable,
  type Lesson,
  type LessonStatus,
  type LessonType,
  lessonsTable,
  type Module,
  type ModuleStatus,
  modulesTable,
  type SyllabusVersion,
  syllabusVersionsTable,
  type VideoMetadata,
} from "./schema";

const MAX_LESSON_BODY_BYTES = 200 * 1024; // 200 KB cap

/**
 * Validates that body JSON doesn't exceed 200 KB.
 */
function assertBodySize(body?: Record<string, unknown> | null) {
  if (!body) return;
  const size = Buffer.byteLength(JSON.stringify(body), "utf-8");
  if (size > MAX_LESSON_BODY_BYTES) {
    throw new AppError({
      code: "VALIDATION",
      message: `Lesson content exceeds maximum allowed size of 200 KB (current size: ${(size / 1024).toFixed(1)} KB).`,
    });
  }
}

/**
 * Validates all prerequisite rules in the section to prevent circular dependencies.
 */
async function assertNoPrerequisiteCycles(
  tx: Tx,
  sectionId: string,
  updatedLessonId: string,
  newRules: DripRule[],
) {
  // Find all modules in section
  const sectionModules = await tx
    .select({ id: modulesTable.id })
    .from(modulesTable)
    .where(eq(modulesTable.sectionId, sectionId));

  const moduleIds = sectionModules.map((m) => m.id);
  if (moduleIds.length === 0) return;

  const allLessons = await tx
    .select({
      id: lessonsTable.id,
      dripRules: lessonsTable.dripRules,
    })
    .from(lessonsTable)
    .where(inArray(lessonsTable.moduleId, moduleIds));

  const graph = allLessons.map((l) => {
    const rules = l.id === updatedLessonId ? newRules : l.dripRules;
    const prereqIds: string[] = [];
    for (const r of rules || []) {
      if (r.kind === "after_completion") {
        prereqIds.push(...r.lessonIds);
      }
    }
    return { id: l.id, prerequisiteIds: prereqIds };
  });

  // If the updated lesson is new, include it
  if (!graph.some((l) => l.id === updatedLessonId)) {
    const prereqIds: string[] = [];
    for (const r of newRules) {
      if (r.kind === "after_completion") {
        prereqIds.push(...r.lessonIds);
      }
    }
    graph.push({ id: updatedLessonId, prerequisiteIds: prereqIds });
  }

  const { valid, cycle } = validatePrerequisiteGraph(graph);
  if (!valid) {
    throw new AppError({
      code: "VALIDATION",
      message: `Prerequisite dependency cycle detected: ${cycle?.join(" -> ")}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export async function createModule(
  tx: Tx,
  actor: Actor,
  input: { sectionId: string; title: string },
): Promise<Module> {
  const allowed = await canManageSectionContent(actor, input.sectionId);
  if (!allowed) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You do not have permission to add modules to this section.",
    });
  }

  // Get last module's position
  const lastModules = await tx
    .select({ position: modulesTable.position })
    .from(modulesTable)
    .where(eq(modulesTable.sectionId, input.sectionId))
    .orderBy(desc(modulesTable.position))
    .limit(1);

  const lastPos = lastModules[0]?.position ?? null;
  const newPos = generateKeyBetween(lastPos, null);

  const [created] = await tx
    .insert(modulesTable)
    .values({
      id: uuidv7(),
      sectionId: input.sectionId,
      title: input.title.trim(),
      position: newPos,
      status: "draft",
    })
    .returning();

  if (!created) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to create module",
    });
  }

  return created;
}

export async function updateModule(
  tx: Tx,
  actor: Actor,
  input: {
    moduleId: string;
    title?: string | undefined;
    status?: ModuleStatus | undefined;
  },
): Promise<Module> {
  const [existing] = await tx
    .select()
    .from(modulesTable)
    .where(eq(modulesTable.id, input.moduleId))
    .limit(1);

  if (!existing) {
    throw new AppError({ code: "NOT_FOUND", message: "Module not found." });
  }

  const allowed = await canManageSectionContent(actor, existing.sectionId);
  if (!allowed) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You do not have permission to edit this module.",
    });
  }

  const [updated] = await tx
    .update(modulesTable)
    .set({
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(modulesTable.id, input.moduleId))
    .returning();

  if (!updated) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to update module",
    });
  }

  return updated;
}

export async function reorderModule(
  tx: Tx,
  actor: Actor,
  input: { moduleId: string; targetPosition: string },
): Promise<Module> {
  const [existing] = await tx
    .select()
    .from(modulesTable)
    .where(eq(modulesTable.id, input.moduleId))
    .limit(1);

  if (!existing) {
    throw new AppError({ code: "NOT_FOUND", message: "Module not found." });
  }

  const allowed = await canManageSectionContent(actor, existing.sectionId);
  if (!allowed) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You do not have permission to reorder modules in this section.",
    });
  }

  const [updated] = await tx
    .update(modulesTable)
    .set({ position: input.targetPosition, updatedAt: new Date() })
    .where(eq(modulesTable.id, input.moduleId))
    .returning();

  if (!updated) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to reorder module",
    });
  }

  return updated;
}

export async function deleteModule(
  tx: Tx,
  actor: Actor,
  moduleId: string,
): Promise<void> {
  const [existing] = await tx
    .select()
    .from(modulesTable)
    .where(eq(modulesTable.id, moduleId))
    .limit(1);

  if (!existing) {
    throw new AppError({ code: "NOT_FOUND", message: "Module not found." });
  }

  const allowed = await canManageSectionContent(actor, existing.sectionId);
  if (!allowed) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You do not have permission to delete this module.",
    });
  }

  await tx.delete(modulesTable).where(eq(modulesTable.id, moduleId));
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export async function createLesson(
  tx: Tx,
  actor: Actor,
  input: {
    moduleId: string;
    type: LessonType;
    title: string;
    body?: Record<string, unknown> | null | undefined;
    fileId?: string | null | undefined;
    video?: VideoMetadata | null | undefined;
    estMinutes?: number | undefined;
    dripRules?: DripRule[] | undefined;
  },
): Promise<Lesson> {
  assertBodySize(input.body);

  const [mod] = await tx
    .select()
    .from(modulesTable)
    .where(eq(modulesTable.id, input.moduleId))
    .limit(1);

  if (!mod) {
    throw new AppError({ code: "NOT_FOUND", message: "Module not found." });
  }

  const allowed = await canManageSectionContent(actor, mod.sectionId);
  if (!allowed) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You do not have permission to author lessons in this section.",
    });
  }

  const newId = uuidv7();

  // Validate prerequisite graph if after_completion rules exist
  if (input.dripRules && input.dripRules.length > 0) {
    await assertNoPrerequisiteCycles(tx, mod.sectionId, newId, input.dripRules);
  }

  // Get last lesson position in module
  const lastLessons = await tx
    .select({ position: lessonsTable.position })
    .from(lessonsTable)
    .where(eq(lessonsTable.moduleId, input.moduleId))
    .orderBy(desc(lessonsTable.position))
    .limit(1);

  const lastPos = lastLessons[0]?.position ?? null;
  const newPos = generateKeyBetween(lastPos, null);

  const [created] = await tx
    .insert(lessonsTable)
    .values({
      id: newId,
      moduleId: input.moduleId,
      type: input.type,
      title: input.title.trim(),
      position: newPos,
      body: input.body ?? null,
      fileId: input.fileId ?? null,
      video: input.video ?? null,
      estMinutes: input.estMinutes ?? 5,
      status: "draft",
      dripRules: input.dripRules ?? [],
    })
    .returning();

  if (!created) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to create lesson",
    });
  }

  return created;
}

export async function updateLesson(
  tx: Tx,
  actor: Actor,
  input: {
    lessonId: string;
    title?: string | undefined;
    body?: Record<string, unknown> | null | undefined;
    fileId?: string | null | undefined;
    video?: VideoMetadata | null | undefined;
    estMinutes?: number | undefined;
    status?: LessonStatus | undefined;
    dripRules?: DripRule[] | undefined;
  },
): Promise<Lesson> {
  if (input.body !== undefined) {
    assertBodySize(input.body);
  }

  const [lesson] = await tx
    .select({
      lesson: lessonsTable,
      sectionId: modulesTable.sectionId,
    })
    .from(lessonsTable)
    .innerJoin(modulesTable, eq(lessonsTable.moduleId, modulesTable.id))
    .where(eq(lessonsTable.id, input.lessonId))
    .limit(1);

  if (!lesson) {
    throw new AppError({ code: "NOT_FOUND", message: "Lesson not found." });
  }

  const allowed = await canManageSectionContent(actor, lesson.sectionId);
  if (!allowed) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You do not have permission to edit this lesson.",
    });
  }

  // Validate prerequisite graph if drip rules updated
  if (input.dripRules !== undefined) {
    await assertNoPrerequisiteCycles(
      tx,
      lesson.sectionId,
      input.lessonId,
      input.dripRules,
    );
  }

  const [updated] = await tx
    .update(lessonsTable)
    .set({
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.fileId !== undefined ? { fileId: input.fileId } : {}),
      ...(input.video !== undefined ? { video: input.video } : {}),
      ...(input.estMinutes !== undefined
        ? { estMinutes: input.estMinutes }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.dripRules !== undefined ? { dripRules: input.dripRules } : {}),
      updatedAt: new Date(),
    })
    .where(eq(lessonsTable.id, input.lessonId))
    .returning();

  if (!updated) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to update lesson",
    });
  }

  return updated;
}

export async function reorderLesson(
  tx: Tx,
  actor: Actor,
  input: {
    lessonId: string;
    targetPosition: string;
    targetModuleId?: string | undefined;
  },
): Promise<Lesson> {
  const [lesson] = await tx
    .select({
      lesson: lessonsTable,
      sectionId: modulesTable.sectionId,
    })
    .from(lessonsTable)
    .innerJoin(modulesTable, eq(lessonsTable.moduleId, modulesTable.id))
    .where(eq(lessonsTable.id, input.lessonId))
    .limit(1);

  if (!lesson) {
    throw new AppError({ code: "NOT_FOUND", message: "Lesson not found." });
  }

  const allowed = await canManageSectionContent(actor, lesson.sectionId);
  if (!allowed) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You do not have permission to reorder lessons in this section.",
    });
  }

  const [updated] = await tx
    .update(lessonsTable)
    .set({
      position: input.targetPosition,
      ...(input.targetModuleId ? { moduleId: input.targetModuleId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(lessonsTable.id, input.lessonId))
    .returning();

  if (!updated) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to reorder lesson",
    });
  }

  return updated;
}

export async function deleteLesson(
  tx: Tx,
  actor: Actor,
  lessonId: string,
): Promise<void> {
  const [lesson] = await tx
    .select({
      lesson: lessonsTable,
      sectionId: modulesTable.sectionId,
    })
    .from(lessonsTable)
    .innerJoin(modulesTable, eq(lessonsTable.moduleId, modulesTable.id))
    .where(eq(lessonsTable.id, lessonId))
    .limit(1);

  if (!lesson) {
    throw new AppError({ code: "NOT_FOUND", message: "Lesson not found." });
  }

  const allowed = await canManageSectionContent(actor, lesson.sectionId);
  if (!allowed) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You do not have permission to delete this lesson.",
    });
  }

  await tx.delete(lessonsTable).where(eq(lessonsTable.id, lessonId));
}

// ---------------------------------------------------------------------------
// Syllabus Publishing
// ---------------------------------------------------------------------------

export async function publishSyllabus(
  tx: Tx,
  actor: Actor,
  input: { sectionId: string; content: Record<string, unknown> },
): Promise<SyllabusVersion> {
  const allowed = await canPublishSectionContent(actor, input.sectionId);
  if (!allowed) {
    throw new AppError({
      code: "FORBIDDEN",
      message:
        "You do not have permission to publish a syllabus for this section.",
    });
  }

  // Get current max version
  const latestVersions = await tx
    .select({ version: syllabusVersionsTable.version })
    .from(syllabusVersionsTable)
    .where(eq(syllabusVersionsTable.sectionId, input.sectionId))
    .orderBy(desc(syllabusVersionsTable.version))
    .limit(1);

  const nextVersion = (latestVersions[0]?.version ?? 0) + 1;

  const [published] = await tx
    .insert(syllabusVersionsTable)
    .values({
      id: uuidv7(),
      sectionId: input.sectionId,
      version: nextVersion,
      content: input.content,
      publishedAt: new Date(),
      publishedBy: actor.userId,
    })
    .returning();

  if (!published) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to publish syllabus",
    });
  }

  // Enqueue syllabus update notification for enrolled students
  await enqueue(
    tx,
    "notifications:syllabus-updated",
    {
      sectionId: input.sectionId,
      version: nextVersion,
    },
    {
      dedupeKey: `syllabus-update:${input.sectionId}:v${nextVersion}`,
    },
  );

  return published;
}

// ---------------------------------------------------------------------------
// Drip Overrides (Accommodations)
// ---------------------------------------------------------------------------

export async function createDripOverride(
  tx: Tx,
  actor: Actor,
  input: {
    studentId: string;
    targetId: string;
    targetType: DripTargetType;
    unlockedAt: Date;
    reason?: string | undefined;
  },
): Promise<DripOverride> {
  if (
    !actor.roles.some((r) => ["admin", "super_admin", "faculty"].includes(r))
  ) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You do not have permission to grant drip overrides.",
    });
  }

  const [override] = await tx
    .insert(dripOverridesTable)
    .values({
      id: uuidv7(),
      studentId: input.studentId,
      targetId: input.targetId,
      targetType: input.targetType,
      unlockedAt: input.unlockedAt,
      reason: input.reason ?? null,
      createdBy: actor.userId,
    })
    .onConflictDoUpdate({
      target: [dripOverridesTable.studentId, dripOverridesTable.targetId],
      set: {
        unlockedAt: input.unlockedAt,
        reason: input.reason ?? null,
        createdBy: actor.userId,
      },
    })
    .returning();

  if (!override) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to create drip override",
    });
  }

  return override;
}

// ---------------------------------------------------------------------------
// Section Cloning (Clone earlier term's course structure in one transaction)
// ---------------------------------------------------------------------------

export async function cloneSection(
  tx: Tx,
  actor: Actor,
  input: {
    sourceSectionId: string;
    targetTermId: string;
    targetCode: string;
    termStartDateShiftDays?: number | undefined;
  },
) {
  // 1. Fetch source section
  const [sourceSection] = await tx
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.id, input.sourceSectionId))
    .limit(1);

  if (!sourceSection) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Source section not found.",
    });
  }

  const allowed = await canManageSectionContent(actor, sourceSection.id);
  if (!allowed) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You do not have permission to clone this section.",
    });
  }

  // 2. Create cloned section row
  const [newSection] = await tx
    .insert(sectionsTable)
    .values({
      id: uuidv7(),
      courseId: sourceSection.courseId,
      termId: input.targetTermId,
      code: input.targetCode.trim(),
      capacity: sourceSection.capacity,
      delivery: sourceSection.delivery,
      status: "draft",
    })
    .returning();

  if (!newSection) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to create cloned section",
    });
  }

  // 3. Fetch source modules
  const sourceModules = await tx
    .select()
    .from(modulesTable)
    .where(eq(modulesTable.sectionId, sourceSection.id))
    .orderBy(modulesTable.position);

  const moduleIdMap = new Map<string, string>(); // sourceModuleId -> newModuleId
  const lessonIdMap = new Map<string, string>(); // sourceLessonId -> newLessonId

  for (const mod of sourceModules) {
    const newModId = uuidv7();
    moduleIdMap.set(mod.id, newModId);

    await tx.insert(modulesTable).values({
      id: newModId,
      sectionId: newSection.id,
      title: mod.title,
      position: mod.position,
      status: "draft",
    });
  }

  // 4. Fetch source lessons
  const sourceModuleIds = sourceModules.map((m) => m.id);
  const sourceLessons =
    sourceModuleIds.length > 0
      ? await tx
          .select()
          .from(lessonsTable)
          .where(inArray(lessonsTable.moduleId, sourceModuleIds))
          .orderBy(lessonsTable.position)
      : [];

  // Assign new IDs for all lessons
  for (const l of sourceLessons) {
    lessonIdMap.set(l.id, uuidv7());
  }

  const dayShiftMs = (input.termStartDateShiftDays ?? 0) * 86_400_000;

  // Insert cloned lessons with shared file references and re-mapped prerequisites / re-based dates
  for (const l of sourceLessons) {
    const newLessonId = lessonIdMap.get(l.id);
    const newModuleId = moduleIdMap.get(l.moduleId);
    if (!newLessonId || !newModuleId) continue;

    // Re-base drip rules:
    const rebasedRules: DripRule[] = (l.dripRules || []).map((rule) => {
      if (rule.kind === "fixed_date" && dayShiftMs !== 0) {
        const shifted = new Date(new Date(rule.date).getTime() + dayShiftMs);
        return { kind: "fixed_date", date: shifted.toISOString() };
      }
      if (rule.kind === "after_completion") {
        const remappedLessonIds = rule.lessonIds
          .map((id) => lessonIdMap.get(id))
          .filter((id): id is string => Boolean(id));
        return {
          kind: "after_completion",
          lessonIds: remappedLessonIds,
          require: rule.require,
        };
      }
      return rule;
    });

    await tx.insert(lessonsTable).values({
      id: newLessonId,
      moduleId: newModuleId,
      type: l.type,
      title: l.title,
      position: l.position,
      body: l.body,
      fileId: l.fileId, // Shared file reference
      video: l.video,
      estMinutes: l.estMinutes,
      status: "draft",
      dripRules: rebasedRules,
    });
  }

  // 5. Clone latest syllabus if available
  const [latestSyllabus] = await tx
    .select()
    .from(syllabusVersionsTable)
    .where(eq(syllabusVersionsTable.sectionId, sourceSection.id))
    .orderBy(desc(syllabusVersionsTable.version))
    .limit(1);

  if (latestSyllabus) {
    await tx.insert(syllabusVersionsTable).values({
      id: uuidv7(),
      sectionId: newSection.id,
      version: 1,
      content: latestSyllabus.content,
      publishedAt: new Date(),
      publishedBy: actor.userId,
    });
  }

  logger.info(
    {
      sourceSectionId: sourceSection.id,
      newSectionId: newSection.id,
      modulesCount: sourceModules.length,
      lessonsCount: sourceLessons.length,
    },
    "Cloned section curriculum successfully",
  );

  return newSection;
}
