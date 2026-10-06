import {
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, lmsSchema } from "@/db/schema/_shared";
import { sectionsTable } from "@/modules/academics/schema";
import { userTable } from "@/modules/identity/schema";

export const enrollmentStatusEnum = lmsSchema.enum("enrollment_status", [
  "enrolled",
  "waitlisted",
  "dropped",
  "withdrawn",
  "completed",
]);

export type EnrollmentStatus = (typeof enrollmentStatusEnum.enumValues)[number];

export const enrollmentSourceEnum = lmsSchema.enum("enrollment_source", [
  "manual",
  "import",
  "purchase",
]);

export type EnrollmentSource = (typeof enrollmentSourceEnum.enumValues)[number];

export const enrollmentsTable = lmsSchema.table(
  "enrollments",
  {
    id: id(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sectionsTable.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    status: enrollmentStatusEnum("status").notNull(),
    source: enrollmentSourceEnum("source").default("manual").notNull(),
    waitlistPosition: integer("waitlist_position"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("enrollments_section_student_uidx").on(
      table.sectionId,
      table.studentId,
    ),
    index("enrollments_section_status_pos_idx").on(
      table.sectionId,
      table.status,
      table.waitlistPosition,
    ),
    index("enrollments_student_status_idx").on(table.studentId, table.status),
  ],
);

export type Enrollment = typeof enrollmentsTable.$inferSelect;
export type InsertEnrollment = typeof enrollmentsTable.$inferInsert;
