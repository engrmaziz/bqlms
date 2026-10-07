"use server";

import { z } from "zod";
import { defineAction } from "@/lib/actions/define-action";
import {
  dripTargetTypeEnum,
  lessonStatusEnum,
  lessonTypeEnum,
  moduleStatusEnum,
} from "./schema";
import {
  cloneSection,
  createDripOverride,
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  publishSyllabus,
  reorderLesson,
  reorderModule,
  updateLesson,
  updateModule,
} from "./service";

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export const createModuleAction = defineAction({
  permission: "section:update",
  rateLimit: { bucket: "write", limit: 60, windowSeconds: 60 },
  input: z.object({
    sectionId: z.string().uuid(),
    title: z.string().min(1).max(255),
  }),
  audit: {
    action: "module:create",
    resourceType: "module",
    resourceId: (_input, output) => (output as { id: string }).id,
  },
  handler: async (tx, actor, input) => {
    return createModule(tx, actor, input);
  },
});

export const updateModuleAction = defineAction({
  permission: "section:update",
  rateLimit: { bucket: "write", limit: 60, windowSeconds: 60 },
  input: z.object({
    moduleId: z.string().uuid(),
    title: z.string().min(1).max(255).optional(),
    status: z.enum(moduleStatusEnum.enumValues).optional(),
  }),
  audit: {
    action: "module:update",
    resourceType: "module",
    resourceId: (input) => input.moduleId,
  },
  handler: async (tx, actor, input) => {
    return updateModule(tx, actor, input);
  },
});

export const reorderModuleAction = defineAction({
  permission: "section:update",
  rateLimit: { bucket: "write", limit: 120, windowSeconds: 60 },
  input: z.object({
    moduleId: z.string().uuid(),
    targetPosition: z.string().min(1),
  }),
  handler: async (tx, actor, input) => {
    return reorderModule(tx, actor, input);
  },
});

export const deleteModuleAction = defineAction({
  permission: "section:update",
  rateLimit: { bucket: "write", limit: 60, windowSeconds: 60 },
  input: z.object({
    moduleId: z.string().uuid(),
  }),
  audit: {
    action: "module:delete",
    resourceType: "module",
    resourceId: (input) => input.moduleId,
  },
  handler: async (tx, actor, input) => {
    return deleteModule(tx, actor, input.moduleId);
  },
});

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

const dripRuleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("fixed_date"),
    date: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("relative_to_enrollment"),
    days: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("relative_to_term_start"),
    days: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("after_completion"),
    lessonIds: z.array(z.string().uuid()),
    require: z.enum(["all", "any"]),
  }),
  z.object({
    kind: z.literal("min_score"),
    assessmentId: z.string().uuid(),
    pct: z.number().min(0).max(100),
  }),
]);

export const createLessonAction = defineAction({
  permission: "section:update",
  rateLimit: { bucket: "write", limit: 60, windowSeconds: 60 },
  input: z.object({
    moduleId: z.string().uuid(),
    type: z.enum(lessonTypeEnum.enumValues),
    title: z.string().min(1).max(255),
    body: z.record(z.string(), z.unknown()).optional(),
    fileId: z.string().uuid().nullable().optional(),
    video: z
      .object({
        url: z.string().url(),
        videoId: z.string(),
        durationSeconds: z.number().optional(),
        estMinutes: z.number().optional(),
      })
      .nullable()
      .optional(),
    estMinutes: z.number().int().positive().optional(),
    dripRules: z.array(dripRuleSchema).optional(),
  }),
  audit: {
    action: "lesson:create",
    resourceType: "lesson",
    resourceId: (_input, output) => (output as { id: string }).id,
  },
  handler: async (tx, actor, input) => {
    return createLesson(tx, actor, input);
  },
});

export const updateLessonAction = defineAction({
  permission: "section:update",
  rateLimit: { bucket: "write", limit: 60, windowSeconds: 60 },
  input: z.object({
    lessonId: z.string().uuid(),
    title: z.string().min(1).max(255).optional(),
    body: z.record(z.string(), z.unknown()).nullable().optional(),
    fileId: z.string().uuid().nullable().optional(),
    video: z
      .object({
        url: z.string().url(),
        videoId: z.string(),
        durationSeconds: z.number().optional(),
        estMinutes: z.number().optional(),
      })
      .nullable()
      .optional(),
    estMinutes: z.number().int().positive().optional(),
    status: z.enum(lessonStatusEnum.enumValues).optional(),
    dripRules: z.array(dripRuleSchema).optional(),
  }),
  audit: {
    action: "lesson:update",
    resourceType: "lesson",
    resourceId: (input) => input.lessonId,
  },
  handler: async (tx, actor, input) => {
    return updateLesson(tx, actor, input);
  },
});

export const reorderLessonAction = defineAction({
  permission: "section:update",
  rateLimit: { bucket: "write", limit: 120, windowSeconds: 60 },
  input: z.object({
    lessonId: z.string().uuid(),
    targetPosition: z.string().min(1),
    targetModuleId: z.string().uuid().optional(),
  }),
  handler: async (tx, actor, input) => {
    return reorderLesson(tx, actor, input);
  },
});

export const deleteLessonAction = defineAction({
  permission: "section:update",
  rateLimit: { bucket: "write", limit: 60, windowSeconds: 60 },
  input: z.object({
    lessonId: z.string().uuid(),
  }),
  audit: {
    action: "lesson:delete",
    resourceType: "lesson",
    resourceId: (input) => input.lessonId,
  },
  handler: async (tx, actor, input) => {
    return deleteLesson(tx, actor, input.lessonId);
  },
});

// ---------------------------------------------------------------------------
// Syllabus Publishing
// ---------------------------------------------------------------------------

export const publishSyllabusAction = defineAction({
  permission: "section:update",
  rateLimit: { bucket: "write", limit: 30, windowSeconds: 60 },
  input: z.object({
    sectionId: z.string().uuid(),
    content: z.record(z.string(), z.unknown()),
  }),
  audit: {
    action: "syllabus:publish",
    resourceType: "syllabus",
    resourceId: (input) => input.sectionId,
  },
  handler: async (tx, actor, input) => {
    return publishSyllabus(tx, actor, input);
  },
});

// ---------------------------------------------------------------------------
// Drip Overrides (Accommodations)
// ---------------------------------------------------------------------------

export const createDripOverrideAction = defineAction({
  permission: "section:update",
  rateLimit: { bucket: "write", limit: 30, windowSeconds: 60 },
  input: z.object({
    studentId: z.string(),
    targetId: z.string().uuid(),
    targetType: z.enum(dripTargetTypeEnum.enumValues),
    unlockedAt: z.coerce.date(),
    reason: z.string().optional(),
  }),
  audit: {
    action: "drip_override:create",
    resourceType: "drip_override",
    resourceId: (input) => input.targetId,
  },
  handler: async (tx, actor, input) => {
    return createDripOverride(tx, actor, input);
  },
});

// ---------------------------------------------------------------------------
// Section Cloning
// ---------------------------------------------------------------------------

export const cloneSectionAction = defineAction({
  permission: "section:update",
  rateLimit: { bucket: "write", limit: 20, windowSeconds: 60 },
  input: z.object({
    sourceSectionId: z.string().uuid(),
    targetTermId: z.string().uuid(),
    targetCode: z.string().min(1).max(50),
    termStartDateShiftDays: z.number().int().optional(),
  }),
  audit: {
    action: "section:clone",
    resourceType: "section",
    resourceId: (_input, output) => (output as { id: string }).id,
  },
  handler: async (tx, actor, input) => {
    return cloneSection(tx, actor, input);
  },
});
