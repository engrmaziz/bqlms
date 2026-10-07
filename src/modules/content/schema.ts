import {
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, lmsSchema, timestamps } from "@/db/schema/_shared";
import { sectionsTable } from "@/modules/academics/schema";
import { filesTable } from "@/modules/files/schema";
import { userTable } from "@/modules/identity/schema";

// 1. Enums
export const moduleStatusEnum = lmsSchema.enum("module_status", [
  "draft",
  "published",
]);
export type ModuleStatus = (typeof moduleStatusEnum.enumValues)[number];

export const lessonStatusEnum = lmsSchema.enum("lesson_status", [
  "draft",
  "published",
]);
export type LessonStatus = (typeof lessonStatusEnum.enumValues)[number];

export const lessonTypeEnum = lmsSchema.enum("lesson_type", [
  "rich_text",
  "video",
  "file",
  "embed",
  "scorm",
  "assessment_ref",
  "live_ref",
]);
export type LessonType = (typeof lessonTypeEnum.enumValues)[number];

export const dripTargetTypeEnum = lmsSchema.enum("drip_target_type", [
  "module",
  "lesson",
]);
export type DripTargetType = (typeof dripTargetTypeEnum.enumValues)[number];

// 2. Drip Rule Definitions
export type DripRule =
  | { kind: "fixed_date"; date: string }
  | { kind: "relative_to_enrollment"; days: number }
  | { kind: "relative_to_term_start"; days: number }
  | { kind: "after_completion"; lessonIds: string[]; require: "all" | "any" }
  | { kind: "min_score"; assessmentId: string; pct: number };

export interface VideoMetadata {
  url: string;
  videoId: string;
  durationSeconds?: number | undefined;
  estMinutes?: number | undefined;
}

// 3. Modules Table
export const modulesTable = lmsSchema.table(
  "modules",
  {
    id: id(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sectionsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: text("position").notNull(),
    status: moduleStatusEnum("status").default("draft").notNull(),
    ...timestamps(),
  },
  (table) => [
    index("modules_section_id_idx").on(table.sectionId),
    index("modules_position_idx").on(table.position),
  ],
);

export type Module = typeof modulesTable.$inferSelect;
export type InsertModule = typeof modulesTable.$inferInsert;

// 4. Lessons Table
export const lessonsTable = lmsSchema.table(
  "lessons",
  {
    id: id(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modulesTable.id, { onDelete: "cascade" }),
    type: lessonTypeEnum("type").notNull(),
    title: text("title").notNull(),
    position: text("position").notNull(),
    body: jsonb("body").$type<Record<string, unknown>>(),
    fileId: uuid("file_id").references(() => filesTable.id, {
      onDelete: "set null",
    }),
    video: jsonb("video").$type<VideoMetadata>(),
    estMinutes: integer("est_minutes").default(5).notNull(),
    status: lessonStatusEnum("status").default("draft").notNull(),
    dripRules: jsonb("drip_rules").$type<DripRule[]>().default([]).notNull(),
    ...timestamps(),
  },
  (table) => [
    index("lessons_module_id_idx").on(table.moduleId),
    index("lessons_position_idx").on(table.position),
  ],
);

export type Lesson = typeof lessonsTable.$inferSelect;
export type InsertLesson = typeof lessonsTable.$inferInsert;

// 5. Syllabus Versions Table (Immutable once published)
export const syllabusVersionsTable = lmsSchema.table(
  "syllabus_versions",
  {
    id: id(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sectionsTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    publishedBy: text("published_by")
      .notNull()
      .references(() => userTable.id, { onDelete: "restrict" }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("syllabus_versions_section_version_uidx").on(
      table.sectionId,
      table.version,
    ),
    index("syllabus_versions_section_id_idx").on(table.sectionId),
  ],
);

export type SyllabusVersion = typeof syllabusVersionsTable.$inferSelect;
export type InsertSyllabusVersion = typeof syllabusVersionsTable.$inferInsert;

// 6. Drip Overrides Table (for accommodations)
export const dripOverridesTable = lmsSchema.table(
  "drip_overrides",
  {
    id: id(),
    studentId: text("student_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    targetId: uuid("target_id").notNull(),
    targetType: dripTargetTypeEnum("target_type").notNull(),
    unlockedAt: timestamp("unlocked_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    reason: text("reason"),
    createdBy: text("created_by")
      .notNull()
      .references(() => userTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("drip_overrides_student_target_uidx").on(
      table.studentId,
      table.targetId,
    ),
    index("drip_overrides_student_id_idx").on(table.studentId),
  ],
);

export type DripOverride = typeof dripOverridesTable.$inferSelect;
export type InsertDripOverride = typeof dripOverridesTable.$inferInsert;
