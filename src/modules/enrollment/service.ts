import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Tx } from "@/db/tx";
import { AppError } from "@/lib/errors";
import { sectionsTable, termsTable } from "@/modules/academics/schema";
import { notify } from "@/modules/notifications";
import { resolveDropEvent } from "./fsm";
import { assertSectionAvailableForEnrollment } from "./policy";
import {
  type Enrollment,
  type EnrollmentSource,
  type EnrollmentStatus,
  enrollmentsTable,
} from "./schema";

export interface EnrollStudentParams {
  sectionId: string;
  studentId: string;
  source?: EnrollmentSource | undefined;
  reason?: string | null | undefined;
  isRegistrarOrAdmin?: boolean | undefined;
}

export interface EnrollStudentResult {
  enrollment: Enrollment;
  status: EnrollmentStatus;
  waitlistPosition: number | null;
  alreadyEnrolled: boolean;
}

export async function enrollStudent(
  tx: Tx,
  params: EnrollStudentParams,
): Promise<EnrollStudentResult> {
  // 1. Lock the section row (SELECT ... FOR UPDATE) to serialize concurrent enrollments
  const [section] = await tx
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.id, params.sectionId))
    .for("update");

  if (!section) {
    throw new AppError({
      code: "NOT_FOUND",
      message: `Section with id "${params.sectionId}" not found.`,
    });
  }

  // 2. Fetch term to check status and policies
  const [term] = await tx
    .select()
    .from(termsTable)
    .where(eq(termsTable.id, section.termId))
    .limit(1);

  if (!term) {
    throw new AppError({
      code: "NOT_FOUND",
      message: `Term with id "${section.termId}" not found.`,
    });
  }

  assertSectionAvailableForEnrollment(
    section,
    term,
    params.isRegistrarOrAdmin ?? false,
    params.reason,
  );

  // 3. Check existing enrollment for this student in this section
  const [existing] = await tx
    .select()
    .from(enrollmentsTable)
    .where(
      and(
        eq(enrollmentsTable.sectionId, params.sectionId),
        eq(enrollmentsTable.studentId, params.studentId),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.status === "enrolled" || existing.status === "waitlisted") {
      return {
        enrollment: existing,
        status: existing.status,
        waitlistPosition: existing.waitlistPosition,
        alreadyEnrolled: true,
      };
    }
  }

  // 4. Count currently enrolled students
  const enrolledCountRes = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(enrollmentsTable)
    .where(
      and(
        eq(enrollmentsTable.sectionId, params.sectionId),
        eq(enrollmentsTable.status, "enrolled"),
      ),
    );

  const enrolledCount = enrolledCountRes[0]?.count ?? 0;

  // 5. If under capacity, insert or update as "enrolled"
  if (enrolledCount < section.capacity) {
    let enrollment: Enrollment;

    if (existing) {
      const [updated] = await tx
        .update(enrollmentsTable)
        .set({
          status: "enrolled",
          waitlistPosition: null,
          source: params.source ?? existing.source,
          updatedAt: new Date(),
        })
        .where(eq(enrollmentsTable.id, existing.id))
        .returning();
      if (!updated) {
        throw new AppError({
          code: "INTERNAL",
          message: "Failed to update enrollment record.",
        });
      }
      enrollment = updated;
    } else {
      const [inserted] = await tx
        .insert(enrollmentsTable)
        .values({
          sectionId: params.sectionId,
          studentId: params.studentId,
          status: "enrolled",
          source: params.source ?? "manual",
          waitlistPosition: null,
        })
        .returning();
      if (!inserted) {
        throw new AppError({
          code: "INTERNAL",
          message: "Failed to insert enrollment record.",
        });
      }
      enrollment = inserted;
    }

    return {
      enrollment,
      status: "enrolled",
      waitlistPosition: null,
      alreadyEnrolled: false,
    };
  }

  // 6. At capacity: calculate next waitlist position
  const maxPosRes = await tx
    .select({ maxPos: sql<number>`coalesce(max(waitlist_position), 0)::int` })
    .from(enrollmentsTable)
    .where(
      and(
        eq(enrollmentsTable.sectionId, params.sectionId),
        eq(enrollmentsTable.status, "waitlisted"),
      ),
    );

  const nextPosition = (maxPosRes[0]?.maxPos ?? 0) + 1;
  let enrollment: Enrollment;

  if (existing) {
    const [updated] = await tx
      .update(enrollmentsTable)
      .set({
        status: "waitlisted",
        waitlistPosition: nextPosition,
        source: params.source ?? existing.source,
        updatedAt: new Date(),
      })
      .where(eq(enrollmentsTable.id, existing.id))
      .returning();
    if (!updated) {
      throw new AppError({
        code: "INTERNAL",
        message: "Failed to update waitlist record.",
      });
    }
    enrollment = updated;
  } else {
    const [inserted] = await tx
      .insert(enrollmentsTable)
      .values({
        sectionId: params.sectionId,
        studentId: params.studentId,
        status: "waitlisted",
        source: params.source ?? "manual",
        waitlistPosition: nextPosition,
      })
      .returning();
    if (!inserted) {
      throw new AppError({
        code: "INTERNAL",
        message: "Failed to insert waitlist record.",
      });
    }
    enrollment = inserted;
  }

  return {
    enrollment,
    status: "waitlisted",
    waitlistPosition: nextPosition,
    alreadyEnrolled: false,
  };
}

export interface DropEnrollmentParams {
  sectionId: string;
  studentId: string;
  reason?: string | null | undefined;
  isRegistrarOrAdmin?: boolean | undefined;
  now?: Date | undefined;
}

export interface DropEnrollmentResult {
  dropped: boolean;
  status: EnrollmentStatus;
  promotedStudentId: string | null;
}

export async function dropEnrollment(
  tx: Tx,
  params: DropEnrollmentParams,
): Promise<DropEnrollmentResult> {
  // 1. Lock the section row
  const [section] = await tx
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.id, params.sectionId))
    .for("update");

  if (!section) {
    throw new AppError({
      code: "NOT_FOUND",
      message: `Section with id "${params.sectionId}" not found.`,
    });
  }

  // 2. Fetch the enrollment row
  const [enrollment] = await tx
    .select()
    .from(enrollmentsTable)
    .where(
      and(
        eq(enrollmentsTable.sectionId, params.sectionId),
        eq(enrollmentsTable.studentId, params.studentId),
      ),
    )
    .limit(1);

  if (!enrollment) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Enrollment record not found for this student in this section.",
    });
  }

  if (enrollment.status === "dropped" || enrollment.status === "withdrawn") {
    return {
      dropped: true,
      status: enrollment.status,
      promotedStudentId: null,
    };
  }

  // 3. If enrollment was waitlisted, drop and recompact waitlist
  if (enrollment.status === "waitlisted") {
    const droppedPos = enrollment.waitlistPosition ?? 0;

    await tx
      .update(enrollmentsTable)
      .set({
        status: "dropped",
        waitlistPosition: null,
        updatedAt: new Date(),
      })
      .where(eq(enrollmentsTable.id, enrollment.id));

    if (droppedPos > 0) {
      await tx
        .update(enrollmentsTable)
        .set({
          waitlistPosition: sql`${enrollmentsTable.waitlistPosition} - 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(enrollmentsTable.sectionId, params.sectionId),
            eq(enrollmentsTable.status, "waitlisted"),
            sql`${enrollmentsTable.waitlistPosition} > ${droppedPos}`,
          ),
        );
    }

    return {
      dropped: true,
      status: "dropped",
      promotedStudentId: null,
    };
  }

  // 4. If enrollment was enrolled, resolve drop vs withdrawn via FSM
  const [term] = await tx
    .select()
    .from(termsTable)
    .where(eq(termsTable.id, section.termId))
    .limit(1);

  if (!term) {
    throw new AppError({
      code: "NOT_FOUND",
      message: `Term with id "${section.termId}" not found.`,
    });
  }

  const { targetStatus } = resolveDropEvent({
    censusDate: term.censusDate,
    termStatus: term.status,
    now: params.now,
    isRegistrarOrAdmin: params.isRegistrarOrAdmin,
    overrideReason: params.reason,
  });

  await tx
    .update(enrollmentsTable)
    .set({
      status: targetStatus,
      waitlistPosition: null,
      updatedAt: new Date(),
    })
    .where(eq(enrollmentsTable.id, enrollment.id));

  // 5. Promote the first waitlisted student in the same transaction
  const [promoted] = await tx
    .select()
    .from(enrollmentsTable)
    .where(
      and(
        eq(enrollmentsTable.sectionId, params.sectionId),
        eq(enrollmentsTable.status, "waitlisted"),
      ),
    )
    .orderBy(asc(enrollmentsTable.waitlistPosition))
    .limit(1)
    .for("update");

  let promotedStudentId: string | null = null;

  if (promoted) {
    promotedStudentId = promoted.studentId;

    await tx
      .update(enrollmentsTable)
      .set({
        status: "enrolled",
        waitlistPosition: null,
        updatedAt: new Date(),
      })
      .where(eq(enrollmentsTable.id, promoted.id));

    // Recompact the remaining waitlist positions
    await tx
      .update(enrollmentsTable)
      .set({
        waitlistPosition: sql`${enrollmentsTable.waitlistPosition} - 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(enrollmentsTable.sectionId, params.sectionId),
          eq(enrollmentsTable.status, "waitlisted"),
        ),
      );

    // Notify the promoted student
    await notify(tx, {
      recipient: promoted.studentId,
      category: "announcement",
      template: "default",
      data: {
        title: "Enrolled from Waitlist",
        body: `You have been automatically enrolled in section ${section.code} from the waitlist.`,
      },
    });
  }

  return {
    dropped: true,
    status: targetStatus,
    promotedStudentId,
  };
}

export async function isEnrolledInSection(
  studentId: string,
  sectionId: string,
  tx?: Tx,
): Promise<boolean> {
  const executor = tx ?? db;
  const [row] = await executor
    .select({ id: enrollmentsTable.id })
    .from(enrollmentsTable)
    .where(
      and(
        eq(enrollmentsTable.studentId, studentId),
        eq(enrollmentsTable.sectionId, sectionId),
        eq(enrollmentsTable.status, "enrolled"),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function listEnrollmentsForSection(
  sectionId: string,
  tx?: Tx,
): Promise<Enrollment[]> {
  const executor = tx ?? db;
  return await executor
    .select()
    .from(enrollmentsTable)
    .where(eq(enrollmentsTable.sectionId, sectionId))
    .orderBy(
      asc(enrollmentsTable.status),
      asc(enrollmentsTable.waitlistPosition),
      desc(enrollmentsTable.createdAt),
    );
}

export async function listEnrollmentsForStudent(
  studentId: string,
  tx?: Tx,
): Promise<Enrollment[]> {
  const executor = tx ?? db;
  return await executor
    .select()
    .from(enrollmentsTable)
    .where(eq(enrollmentsTable.studentId, studentId))
    .orderBy(desc(enrollmentsTable.createdAt));
}
