import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  coursesTable,
  sectionsTable,
  termsTable,
} from "@/modules/academics/schema";
import { profilesTable, userTable } from "@/modules/identity/schema";
import { type Enrollment, enrollmentsTable } from "./schema";

export interface EnrollmentWithStudent extends Enrollment {
  student: {
    id: string;
    name: string;
    email: string;
    studentNumber: string | null;
  };
}

export async function getEnrollmentsForSectionQuery(
  sectionId: string,
): Promise<EnrollmentWithStudent[]> {
  const rows = await db
    .select({
      enrollment: enrollmentsTable,
      user: {
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
      },
      profile: {
        studentNumber: profilesTable.studentNumber,
      },
    })
    .from(enrollmentsTable)
    .innerJoin(userTable, eq(enrollmentsTable.studentId, userTable.id))
    .leftJoin(profilesTable, eq(userTable.id, profilesTable.userId))
    .where(eq(enrollmentsTable.sectionId, sectionId))
    .orderBy(
      asc(enrollmentsTable.status),
      asc(enrollmentsTable.waitlistPosition),
      desc(enrollmentsTable.createdAt),
    );

  return rows.map((r) => ({
    ...r.enrollment,
    student: {
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      studentNumber: r.profile?.studentNumber ?? null,
    },
  }));
}

export async function getEnrollmentsForStudentQuery(studentId: string) {
  return await db
    .select({
      enrollment: enrollmentsTable,
      section: sectionsTable,
      course: coursesTable,
      term: termsTable,
    })
    .from(enrollmentsTable)
    .innerJoin(sectionsTable, eq(enrollmentsTable.sectionId, sectionsTable.id))
    .innerJoin(coursesTable, eq(sectionsTable.courseId, coursesTable.id))
    .innerJoin(termsTable, eq(sectionsTable.termId, termsTable.id))
    .where(eq(enrollmentsTable.studentId, studentId))
    .orderBy(desc(enrollmentsTable.createdAt));
}

export async function getSectionCapacityQuery(sectionId: string): Promise<{
  capacity: number;
  enrolledCount: number;
  waitlistedCount: number;
}> {
  const [section] = await db
    .select({ capacity: sectionsTable.capacity })
    .from(sectionsTable)
    .where(eq(sectionsTable.id, sectionId))
    .limit(1);

  const counts = await db
    .select({
      status: enrollmentsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(enrollmentsTable)
    .where(eq(enrollmentsTable.sectionId, sectionId))
    .groupBy(enrollmentsTable.status);

  let enrolledCount = 0;
  let waitlistedCount = 0;

  for (const c of counts) {
    if (c.status === "enrolled") enrolledCount = c.count;
    if (c.status === "waitlisted") waitlistedCount = c.count;
  }

  return {
    capacity: section?.capacity ?? 0,
    enrolledCount,
    waitlistedCount,
  };
}
