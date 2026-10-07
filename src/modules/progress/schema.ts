import {
  index,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, lmsSchema, timestamps } from "@/db/schema/_shared";
import { lessonsTable } from "@/modules/content/schema";
import { enrollmentsTable } from "@/modules/enrollment/schema";

// 1. Enums
export const progressStatusEnum = lmsSchema.enum("progress_status", [
  "not_started",
  "in_progress",
  "completed",
]);
export type ProgressStatus = (typeof progressStatusEnum.enumValues)[number];

// 2. Lesson Progress Table
export const lessonProgressTable = lmsSchema.table(
  "lesson_progress",
  {
    id: id(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollmentsTable.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessonsTable.id, { onDelete: "cascade" }),
    status: progressStatusEnum("status").default("not_started").notNull(),
    progressPct: integer("progress_pct").default(0).notNull(),
    lastPositionS: integer("last_position_s").default(0).notNull(),
    watched: jsonb("watched").$type<[number, number][]>().default([]).notNull(),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("lesson_progress_enrollment_lesson_uidx").on(
      table.enrollmentId,
      table.lessonId,
    ),
    index("lesson_progress_enrollment_status_idx").on(
      table.enrollmentId,
      table.status,
    ),
  ],
);

export type LessonProgress = typeof lessonProgressTable.$inferSelect;
export type InsertLessonProgress = typeof lessonProgressTable.$inferInsert;

// 3. Section Completions Table (exactly once per enrollment)
export const sectionCompletionsTable = lmsSchema.table(
  "section_completions",
  {
    id: id(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .unique()
      .references(() => enrollmentsTable.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("section_completions_enrollment_uidx").on(table.enrollmentId),
  ],
);

export type SectionCompletion = typeof sectionCompletionsTable.$inferSelect;
export type InsertSectionCompletion =
  typeof sectionCompletionsTable.$inferInsert;
