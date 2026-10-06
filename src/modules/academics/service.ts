import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import type { Tx } from "@/db/tx";
import { AppError } from "@/lib/errors";
import {
  validateCourseCode,
  validateScheduleInterval,
  validateSectionCapacity,
  validateTermDates,
} from "./policy";
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

// --- Terms ---

export async function createTerm(
  tx: Tx,
  input: {
    name: string;
    startsOn: Date;
    endsOn: Date;
    censusDate: Date;
    status?: ("planned" | "active" | "closed") | undefined;
  },
): Promise<Term> {
  validateTermDates(input.startsOn, input.censusDate, input.endsOn);

  const [term] = await tx
    .insert(termsTable)
    .values({
      name: input.name.trim(),
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      censusDate: input.censusDate,
      status: input.status ?? "planned",
    })
    .returning();

  if (!term) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to create term.",
    });
  }

  return term;
}

export async function updateTerm(
  tx: Tx,
  id: string,
  input: {
    name?: string | undefined;
    startsOn?: Date | undefined;
    endsOn?: Date | undefined;
    censusDate?: Date | undefined;
    status?: ("planned" | "active" | "closed") | undefined;
  },
): Promise<Term> {
  const existing = await getTermById(id, tx);
  if (!existing) {
    throw new AppError({
      code: "NOT_FOUND",
      message: `Term with id "${id}" not found.`,
    });
  }

  const startsOn = input.startsOn ?? existing.startsOn;
  const endsOn = input.endsOn ?? existing.endsOn;
  const censusDate = input.censusDate ?? existing.censusDate;
  validateTermDates(startsOn, censusDate, endsOn);

  const [updated] = await tx
    .update(termsTable)
    .set({
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.startsOn ? { startsOn: input.startsOn } : {}),
      ...(input.endsOn ? { endsOn: input.endsOn } : {}),
      ...(input.censusDate ? { censusDate: input.censusDate } : {}),
      ...(input.status ? { status: input.status } : {}),
    })
    .where(eq(termsTable.id, id))
    .returning();

  if (!updated) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to update term.",
    });
  }

  return updated;
}

export async function getTermById(id: string, tx?: Tx): Promise<Term | null> {
  const executor = tx ?? db;
  const [term] = await executor
    .select()
    .from(termsTable)
    .where(eq(termsTable.id, id))
    .limit(1);

  return term ?? null;
}

export async function listTerms(tx?: Tx): Promise<Term[]> {
  const executor = tx ?? db;
  return await executor
    .select()
    .from(termsTable)
    .orderBy(desc(termsTable.startsOn));
}

// --- Courses ---

export async function createCourse(
  tx: Tx,
  input: {
    code: string;
    title: string;
    credits?: number | undefined;
  },
): Promise<Course> {
  const code = validateCourseCode(input.code);

  const existing = await getCourseByCode(code, tx);
  if (existing) {
    throw new AppError({
      code: "CONFLICT",
      message: `Course with code "${code}" already exists.`,
    });
  }

  const [course] = await tx
    .insert(coursesTable)
    .values({
      code,
      title: input.title.trim(),
      credits: input.credits ?? 3,
    })
    .returning();

  if (!course) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to create course.",
    });
  }

  return course;
}

export async function updateCourse(
  tx: Tx,
  id: string,
  input: {
    code?: string | undefined;
    title?: string | undefined;
    credits?: number | undefined;
  },
): Promise<Course> {
  const existing = await getCourseById(id, tx);
  if (!existing) {
    throw new AppError({
      code: "NOT_FOUND",
      message: `Course with id "${id}" not found.`,
    });
  }

  const code = input.code ? validateCourseCode(input.code) : existing.code;
  if (code !== existing.code) {
    const conflict = await getCourseByCode(code, tx);
    if (conflict) {
      throw new AppError({
        code: "CONFLICT",
        message: `Course with code "${code}" already exists.`,
      });
    }
  }

  const [updated] = await tx
    .update(coursesTable)
    .set({
      ...(input.code ? { code } : {}),
      ...(input.title ? { title: input.title.trim() } : {}),
      ...(input.credits !== undefined ? { credits: input.credits } : {}),
    })
    .where(eq(coursesTable.id, id))
    .returning();

  if (!updated) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to update course.",
    });
  }

  return updated;
}

export async function getCourseById(
  id: string,
  tx?: Tx,
): Promise<Course | null> {
  const executor = tx ?? db;
  const [course] = await executor
    .select()
    .from(coursesTable)
    .where(eq(coursesTable.id, id))
    .limit(1);

  return course ?? null;
}

export async function getCourseByCode(
  code: string,
  tx?: Tx,
): Promise<Course | null> {
  const executor = tx ?? db;
  const normalized = code.trim().toUpperCase();
  const [course] = await executor
    .select()
    .from(coursesTable)
    .where(eq(coursesTable.code, normalized))
    .limit(1);

  return course ?? null;
}

export async function listCourses(tx?: Tx): Promise<Course[]> {
  const executor = tx ?? db;
  return await executor.select().from(coursesTable).orderBy(coursesTable.code);
}

// --- Sections ---

export async function createSection(
  tx: Tx,
  input: {
    courseId: string;
    termId: string;
    code: string;
    capacity: number;
    delivery?: ("in_person" | "online" | "hybrid") | undefined;
    status?: ("draft" | "published" | "archived") | undefined;
  },
): Promise<Section> {
  validateSectionCapacity(input.capacity);

  const term = await getTermById(input.termId, tx);
  if (!term) {
    throw new AppError({
      code: "NOT_FOUND",
      message: `Term "${input.termId}" not found.`,
    });
  }

  const course = await getCourseById(input.courseId, tx);
  if (!course) {
    throw new AppError({
      code: "NOT_FOUND",
      message: `Course "${input.courseId}" not found.`,
    });
  }

  const sectionCode = input.code.trim().toUpperCase();

  // Check unique on (termId, code)
  const [existing] = await tx
    .select()
    .from(sectionsTable)
    .where(
      and(
        eq(sectionsTable.termId, input.termId),
        eq(sectionsTable.code, sectionCode),
      ),
    )
    .limit(1);

  if (existing) {
    throw new AppError({
      code: "CONFLICT",
      message: `Section with code "${sectionCode}" already exists in this term.`,
    });
  }

  const [section] = await tx
    .insert(sectionsTable)
    .values({
      courseId: input.courseId,
      termId: input.termId,
      code: sectionCode,
      capacity: input.capacity,
      delivery: input.delivery ?? "in_person",
      status: input.status ?? "draft",
    })
    .returning();

  if (!section) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to create section.",
    });
  }

  return section;
}

export async function updateSection(
  tx: Tx,
  id: string,
  input: {
    capacity?: number | undefined;
    delivery?: ("in_person" | "online" | "hybrid") | undefined;
    status?: ("draft" | "published" | "archived") | undefined;
  },
): Promise<Section> {
  const existing = await getSectionById(id, tx);
  if (!existing) {
    throw new AppError({
      code: "NOT_FOUND",
      message: `Section with id "${id}" not found.`,
    });
  }

  if (input.capacity !== undefined) {
    validateSectionCapacity(input.capacity);
  }

  const [updated] = await tx
    .update(sectionsTable)
    .set({
      ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
      ...(input.delivery ? { delivery: input.delivery } : {}),
      ...(input.status ? { status: input.status } : {}),
    })
    .where(eq(sectionsTable.id, id))
    .returning();

  if (!updated) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to update section.",
    });
  }

  return updated;
}

export async function getSectionById(
  id: string,
  tx?: Tx,
): Promise<Section | null> {
  const executor = tx ?? db;
  const [section] = await executor
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.id, id))
    .limit(1);

  return section ?? null;
}

export async function listSections(
  filter?: { termId?: string; courseId?: string; status?: Section["status"] },
  tx?: Tx,
): Promise<Section[]> {
  const executor = tx ?? db;
  const conditions = [];

  if (filter?.termId) {
    conditions.push(eq(sectionsTable.termId, filter.termId));
  }
  if (filter?.courseId) {
    conditions.push(eq(sectionsTable.courseId, filter.courseId));
  }
  if (filter?.status) {
    conditions.push(eq(sectionsTable.status, filter.status));
  }

  return await executor
    .select()
    .from(sectionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sectionsTable.code);
}

// --- Instructors ---

export async function assignInstructor(
  tx: Tx,
  input: {
    sectionId: string;
    userId: string;
    role?: ("lead" | "co" | "ta") | undefined;
  },
): Promise<SectionInstructor> {
  const [instructor] = await tx
    .insert(sectionInstructorsTable)
    .values({
      sectionId: input.sectionId,
      userId: input.userId,
      role: input.role ?? "lead",
    })
    .onConflictDoUpdate({
      target: [
        sectionInstructorsTable.sectionId,
        sectionInstructorsTable.userId,
      ],
      set: {
        role: input.role ?? "lead",
      },
    })
    .returning();

  if (!instructor) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to assign instructor.",
    });
  }

  return instructor;
}

export async function removeInstructor(
  tx: Tx,
  sectionId: string,
  userId: string,
): Promise<boolean> {
  const result = await tx
    .delete(sectionInstructorsTable)
    .where(
      and(
        eq(sectionInstructorsTable.sectionId, sectionId),
        eq(sectionInstructorsTable.userId, userId),
      ),
    )
    .returning();

  return result.length > 0;
}

export async function listInstructorsForSection(
  sectionId: string,
  tx?: Tx,
): Promise<SectionInstructor[]> {
  const executor = tx ?? db;
  return await executor
    .select()
    .from(sectionInstructorsTable)
    .where(eq(sectionInstructorsTable.sectionId, sectionId));
}

export async function isInstructorOfSection(
  userId: string,
  sectionId: string,
  tx?: Tx,
): Promise<boolean> {
  const executor = tx ?? db;
  const [row] = await executor
    .select({ sectionId: sectionInstructorsTable.sectionId })
    .from(sectionInstructorsTable)
    .where(
      and(
        eq(sectionInstructorsTable.userId, userId),
        eq(sectionInstructorsTable.sectionId, sectionId),
      ),
    )
    .limit(1);

  return Boolean(row);
}

// --- Schedules ---

export async function addSchedule(
  tx: Tx,
  input: {
    sectionId: string;
    weekday: number;
    startTime: string;
    endTime: string;
    room?: string | null | undefined;
    effectiveFrom?: Date | null | undefined;
    effectiveTo?: Date | null | undefined;
  },
): Promise<SectionSchedule> {
  validateScheduleInterval(input.startTime, input.endTime);

  let effectiveFrom = input.effectiveFrom ?? null;
  let effectiveTo = input.effectiveTo ?? null;

  if (!effectiveFrom) {
    const section = await getSectionById(input.sectionId, tx);
    if (section) {
      const term = await getTermById(section.termId, tx);
      if (term) {
        effectiveFrom = term.startsOn;
        if (!effectiveTo) {
          effectiveTo = term.endsOn;
        }
      }
    }
    if (!effectiveFrom) {
      effectiveFrom = new Date();
    }
  }

  const [schedule] = await tx
    .insert(sectionSchedulesTable)
    .values({
      sectionId: input.sectionId,
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      room: input.room?.trim() || "TBA",
      effectiveFrom,
      effectiveTo,
    })
    .returning();

  if (!schedule) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to add section schedule.",
    });
  }

  return schedule;
}

export async function removeSchedule(
  tx: Tx,
  scheduleId: string,
): Promise<boolean> {
  const result = await tx
    .delete(sectionSchedulesTable)
    .where(eq(sectionSchedulesTable.id, scheduleId))
    .returning();

  return result.length > 0;
}

export async function listSchedulesForSection(
  sectionId: string,
  tx?: Tx,
): Promise<SectionSchedule[]> {
  const executor = tx ?? db;
  return await executor
    .select()
    .from(sectionSchedulesTable)
    .where(eq(sectionSchedulesTable.sectionId, sectionId))
    .orderBy(sectionSchedulesTable.weekday, sectionSchedulesTable.startTime);
}

// --- Holidays ---

export async function addHoliday(
  tx: Tx,
  input: { date: Date; name: string },
): Promise<Holiday> {
  const [holiday] = await tx
    .insert(holidaysTable)
    .values({
      date: input.date,
      name: input.name.trim(),
    })
    .onConflictDoUpdate({
      target: holidaysTable.date,
      set: {
        name: input.name.trim(),
      },
    })
    .returning();

  if (!holiday) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to add holiday.",
    });
  }

  return holiday;
}

export async function listHolidays(tx?: Tx): Promise<Holiday[]> {
  const executor = tx ?? db;
  return await executor
    .select()
    .from(holidaysTable)
    .orderBy(holidaysTable.date);
}

export async function deleteHoliday(
  tx: Tx,
  holidayId: string,
): Promise<boolean> {
  const result = await tx
    .delete(holidaysTable)
    .where(eq(holidaysTable.id, holidayId))
    .returning();

  return result.length > 0;
}

export {
  addHoliday as createHoliday,
  listHolidays as getHolidayListQuery,
  assignInstructor as addSectionInstructor,
  addSchedule as addSectionSchedule,
  removeSchedule as removeSectionSchedule,
};
