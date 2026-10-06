import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userTable } from "@/modules/identity/schema";
import {
  type Course,
  coursesTable,
  type Holiday,
  holidaysTable,
  type Section,
  type SectionInstructor,
  type SectionSchedule,
  sectionInstructorsTable,
  sectionSchedulesTable,
  sectionsTable,
  type Term,
  termsTable,
} from "./schema";

export async function getTermsQuery(): Promise<Term[]> {
  return await db.select().from(termsTable).orderBy(desc(termsTable.startsOn));
}

export async function getCoursesQuery(): Promise<Course[]> {
  return await db.select().from(coursesTable).orderBy(coursesTable.code);
}

export interface SectionWithDetails extends Section {
  course: Course;
  term: Term;
  instructors: Array<
    SectionInstructor & { user: { id: string; name: string; email: string } }
  >;
  schedules: SectionSchedule[];
}

export async function getSectionsQuery(filter?: {
  termId?: string;
  courseId?: string;
}): Promise<Array<Section & { course: Course; term: Term }>> {
  const conditions = [];
  if (filter?.termId) conditions.push(eq(sectionsTable.termId, filter.termId));
  if (filter?.courseId)
    conditions.push(eq(sectionsTable.courseId, filter.courseId));

  const rows = await db
    .select({
      section: sectionsTable,
      course: coursesTable,
      term: termsTable,
    })
    .from(sectionsTable)
    .innerJoin(coursesTable, eq(sectionsTable.courseId, coursesTable.id))
    .innerJoin(termsTable, eq(sectionsTable.termId, termsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(termsTable.startsOn, sectionsTable.code);

  return rows.map((r) => ({
    ...r.section,
    course: r.course,
    term: r.term,
  }));
}

export async function getSectionDetailsQuery(
  sectionId: string,
): Promise<SectionWithDetails | null> {
  const [row] = await db
    .select({
      section: sectionsTable,
      course: coursesTable,
      term: termsTable,
    })
    .from(sectionsTable)
    .innerJoin(coursesTable, eq(sectionsTable.courseId, coursesTable.id))
    .innerJoin(termsTable, eq(sectionsTable.termId, termsTable.id))
    .where(eq(sectionsTable.id, sectionId))
    .limit(1);

  if (!row) {
    return null;
  }

  const instructors = await db
    .select({
      instructor: sectionInstructorsTable,
      user: {
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
      },
    })
    .from(sectionInstructorsTable)
    .innerJoin(userTable, eq(sectionInstructorsTable.userId, userTable.id))
    .where(eq(sectionInstructorsTable.sectionId, sectionId));

  const schedules = await db
    .select()
    .from(sectionSchedulesTable)
    .where(eq(sectionSchedulesTable.sectionId, sectionId))
    .orderBy(sectionSchedulesTable.weekday, sectionSchedulesTable.startTime);

  return {
    ...row.section,
    course: row.course,
    term: row.term,
    instructors: instructors.map((i) => ({
      ...i.instructor,
      user: i.user,
    })),
    schedules,
  };
}

export async function getHolidaysQuery(): Promise<Holiday[]> {
  return await db.select().from(holidaysTable).orderBy(holidaysTable.date);
}
