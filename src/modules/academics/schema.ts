import {
  index,
  integer,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, lmsSchema } from "@/db/schema/_shared";
import { userTable } from "@/modules/identity/schema";

export const termStatusEnum = lmsSchema.enum("term_status", [
  "planned",
  "active",
  "closed",
]);

export type TermStatus = (typeof termStatusEnum.enumValues)[number];

export const termsTable = lmsSchema.table("terms", {
  id: id(),
  name: text("name").notNull(),
  startsOn: timestamp("starts_on", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  endsOn: timestamp("ends_on", { withTimezone: true, mode: "date" }).notNull(),
  censusDate: timestamp("census_date", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  status: termStatusEnum("status").default("planned").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

export type Term = typeof termsTable.$inferSelect;
export type InsertTerm = typeof termsTable.$inferInsert;

export const coursesTable = lmsSchema.table("courses", {
  id: id(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  credits: integer("credits").default(3).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

export type Course = typeof coursesTable.$inferSelect;
export type InsertCourse = typeof coursesTable.$inferInsert;

export const sectionDeliveryEnum = lmsSchema.enum("section_delivery", [
  "in_person",
  "online",
  "hybrid",
]);

export type SectionDelivery = (typeof sectionDeliveryEnum.enumValues)[number];

export const sectionStatusEnum = lmsSchema.enum("section_status", [
  "draft",
  "published",
  "archived",
]);

export type SectionStatus = (typeof sectionStatusEnum.enumValues)[number];

export const sectionsTable = lmsSchema.table(
  "sections",
  {
    id: id(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => coursesTable.id, { onDelete: "cascade" }),
    termId: uuid("term_id")
      .notNull()
      .references(() => termsTable.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    capacity: integer("capacity").notNull(),
    delivery: sectionDeliveryEnum("delivery").default("in_person").notNull(),
    status: sectionStatusEnum("status").default("draft").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("sections_term_code_uidx").on(table.termId, table.code),
    index("sections_course_id_idx").on(table.courseId),
    index("sections_term_id_idx").on(table.termId),
  ],
);

export type Section = typeof sectionsTable.$inferSelect;
export type InsertSection = typeof sectionsTable.$inferInsert;

export const sectionInstructorRoleEnum = lmsSchema.enum(
  "section_instructor_role",
  ["lead", "co", "ta"],
);

export type SectionInstructorRole =
  (typeof sectionInstructorRoleEnum.enumValues)[number];

export const sectionInstructorsTable = lmsSchema.table(
  "section_instructors",
  {
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sectionsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    role: sectionInstructorRoleEnum("role").default("lead").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sectionId, table.userId] }),
    index("section_instructors_user_id_idx").on(table.userId),
  ],
);

export type SectionInstructor = typeof sectionInstructorsTable.$inferSelect;
export type InsertSectionInstructor =
  typeof sectionInstructorsTable.$inferInsert;

export const sectionSchedulesTable = lmsSchema.table(
  "section_schedules",
  {
    id: id(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sectionsTable.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(), // 1 (Mon) - 7 (Sun)
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    room: text("room"),
    effectiveFrom: timestamp("effective_from", {
      withTimezone: true,
      mode: "date",
    }),
    effectiveTo: timestamp("effective_to", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("section_schedules_section_id_idx").on(table.sectionId)],
);

export type SectionSchedule = typeof sectionSchedulesTable.$inferSelect;
export type InsertSectionSchedule = typeof sectionSchedulesTable.$inferInsert;

export const holidaysTable = lmsSchema.table("holidays", {
  id: id(),
  date: timestamp("date", { withTimezone: true, mode: "date" })
    .notNull()
    .unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

export type Holiday = typeof holidaysTable.$inferSelect;
export type InsertHoliday = typeof holidaysTable.$inferInsert;
