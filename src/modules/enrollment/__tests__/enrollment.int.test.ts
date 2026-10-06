import { eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { withTx } from "@/db/tx";
import type { Actor } from "@/lib/auth/session";
import { can } from "@/lib/authz/can";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { fakeEmailProvider } from "@/lib/providers/email";
import {
  addSectionInstructor,
  createCourse,
  createSection,
  createTerm,
  updateTerm,
} from "@/modules/academics";
import { createUserWithProfile } from "@/modules/identity";
import { userTable } from "@/modules/identity/schema";
import { drainJobs } from "@/modules/jobs";
import { notificationDeliveriesTable } from "@/modules/notifications";
import {
  applyImport,
  dropEnrollment,
  dryRunImport,
  emailAllInvites,
  enrollStudent,
  getEnrollmentsForSectionQuery,
} from "..";

describe("Enrollment Module Integration Tests", () => {
  let registrarUser: { id: string; email: string };

  beforeAll(async () => {
    const { user } = await createUserWithProfile({
      name: "Registrar Officer",
      email: `registrar_tester_${Date.now()}@college.edu`,
      password: "TestPassword123!",
      roles: ["registrar"],
      status: "active",
    });
    registrarUser = user;
  });

  it("proves 40 concurrent enroll calls into a capacity-30 section give exactly 30 enrolled and 10 waitlisted in order, and a drop promotes waitlist position 1", async () => {
    // 1. Setup Term, Course, and Section with capacity 30
    const term = await withTx(async (tx) => {
      return createTerm(tx, {
        name: `Term Concurrency - ${Date.now()}`,
        startsOn: new Date("2026-09-01T00:00:00Z"),
        endsOn: new Date("2026-12-15T00:00:00Z"),
        censusDate: new Date("2026-09-20T00:00:00Z"),
        status: "active",
      });
    });

    const course = await withTx(async (tx) => {
      return createCourse(tx, {
        code: `CONC${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "Concurrent Systems",
        credits: 3,
      });
    });

    const section = await withTx(async (tx) => {
      return createSection(tx, {
        courseId: course.id,
        termId: term.id,
        code: "01",
        capacity: 30,
        status: "published",
      });
    });

    // 2. Create 40 distinct test students
    const studentIds: string[] = [];
    for (let i = 0; i < 40; i++) {
      const studentId = uuidv7();
      studentIds.push(studentId);
      await db.insert(userTable).values({
        id: studentId,
        name: `Student Concurrency ${i}`,
        email: `student_conc_${i}_${Date.now()}@college.edu`,
        emailVerified: true,
      });
    }

    // 3. Fire 40 concurrent enroll calls using Promise.all
    await Promise.all(
      studentIds.map((studentId) =>
        withTx(async (tx) => {
          return enrollStudent(tx, {
            sectionId: section.id,
            studentId,
          });
        }),
      ),
    );

    // 4. Verify exactly 30 enrolled and 10 waitlisted in sequential order
    const allEnrollments = await getEnrollmentsForSectionQuery(section.id);
    expect(allEnrollments.length).toBe(40);

    const enrolledList = allEnrollments.filter((e) => e.status === "enrolled");
    const waitlistedList = allEnrollments.filter(
      (e) => e.status === "waitlisted",
    );

    expect(enrolledList.length).toBe(30);
    for (const enr of enrolledList) {
      expect(enr.waitlistPosition).toBeNull();
    }

    expect(waitlistedList.length).toBe(10);

    // Waitlisted students must be numbered 1 through 10
    const sortedWaitlist = [...waitlistedList].sort(
      (a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0),
    );
    const positions = sortedWaitlist.map((w) => w.waitlistPosition);
    expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    // 5. Test: A drop promotes waitlist position 1
    const firstWaitlistedStudentId = sortedWaitlist[0]?.studentId;
    expect(firstWaitlistedStudentId).toBeDefined();

    const enrolledToDrop = enrolledList[0];
    expect(enrolledToDrop).toBeDefined();

    const dropRes = await withTx(async (tx) => {
      return dropEnrollment(tx, {
        sectionId: section.id,
        studentId: enrolledToDrop?.studentId ?? "",
      });
    });

    expect(dropRes.dropped).toBe(true);
    expect(dropRes.promotedStudentId).toBe(firstWaitlistedStudentId);

    // Verify DB state after drop:
    const updatedEnrollments = await getEnrollmentsForSectionQuery(section.id);
    const newEnrolled = updatedEnrollments.filter(
      (e) => e.status === "enrolled",
    );
    const newWaitlisted = updatedEnrollments.filter(
      (e) => e.status === "waitlisted",
    );

    expect(newEnrolled.length).toBe(30);
    expect(
      newEnrolled.some((e) => e.studentId === firstWaitlistedStudentId),
    ).toBe(true);

    expect(newWaitlisted.length).toBe(9);
    const newPositions = [...newWaitlisted]
      .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0))
      .map((w) => w.waitlistPosition);
    expect(newPositions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("proves enrollment FSM: drop before census_date -> dropped; after -> withdrawn; closed term requires registrar override", async () => {
    const censusDate = new Date("2026-10-15T00:00:00Z");
    const term = await withTx(async (tx) => {
      return createTerm(tx, {
        name: `FSM Term - ${Date.now()}`,
        startsOn: new Date("2026-09-01T00:00:00Z"),
        endsOn: new Date("2026-12-15T00:00:00Z"),
        censusDate,
        status: "active",
      });
    });

    const course = await withTx(async (tx) => {
      return createCourse(tx, {
        code: `FSM${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "State Machines",
        credits: 3,
      });
    });

    const section = await withTx(async (tx) => {
      return createSection(tx, {
        courseId: course.id,
        termId: term.id,
        code: "01",
        capacity: 10,
        status: "published",
      });
    });

    // Student A: drop BEFORE census_date
    const studentAId = uuidv7();
    await db.insert(userTable).values({
      id: studentAId,
      name: "Student A",
      email: `student_a_${Date.now()}@college.edu`,
      emailVerified: true,
    });

    await withTx(async (tx) => {
      await enrollStudent(tx, { sectionId: section.id, studentId: studentAId });
    });

    const dropBeforeCensus = await withTx(async (tx) => {
      return dropEnrollment(tx, {
        sectionId: section.id,
        studentId: studentAId,
        now: new Date("2026-10-10T00:00:00Z"), // Before census
      });
    });
    expect(dropBeforeCensus.status).toBe("dropped");

    // Student B: drop AFTER census_date
    const studentBId = uuidv7();
    await db.insert(userTable).values({
      id: studentBId,
      name: "Student B",
      email: `student_b_${Date.now()}@college.edu`,
      emailVerified: true,
    });

    await withTx(async (tx) => {
      await enrollStudent(tx, { sectionId: section.id, studentId: studentBId });
    });

    const dropAfterCensus = await withTx(async (tx) => {
      return dropEnrollment(tx, {
        sectionId: section.id,
        studentId: studentBId,
        now: new Date("2026-10-20T00:00:00Z"), // After census
      });
    });
    expect(dropAfterCensus.status).toBe("withdrawn");

    // Student C: closed term requires registrar override with reason
    const studentCId = uuidv7();
    await db.insert(userTable).values({
      id: studentCId,
      name: "Student C",
      email: `student_c_${Date.now()}@college.edu`,
      emailVerified: true,
    });

    await withTx(async (tx) => {
      await enrollStudent(tx, { sectionId: section.id, studentId: studentCId });
      // Close the term
      await updateTerm(tx, term.id, { status: "closed" });
    });

    // Attempting to drop in closed term without override throws AppError
    await expect(
      withTx(async (tx) =>
        dropEnrollment(tx, {
          sectionId: section.id,
          studentId: studentCId,
          isRegistrarOrAdmin: false,
        }),
      ),
    ).rejects.toThrowError(AppError);

    // Dropping with registrar override and reason succeeds
    const closedDrop = await withTx(async (tx) => {
      return dropEnrollment(tx, {
        sectionId: section.id,
        studentId: studentCId,
        isRegistrarOrAdmin: true,
        reason: "Administrative approval by Registrar Council",
      });
    });
    expect(closedDrop.dropped).toBe(true);
  });

  it("proves CSV dry run writes nothing and re-applying the same file is a no-op", async () => {
    const timestamp = Date.now();
    const term = await withTx(async (tx) => {
      return createTerm(tx, {
        name: `Import Term ${timestamp}`,
        startsOn: new Date("2026-09-01T00:00:00Z"),
        endsOn: new Date("2026-12-15T00:00:00Z"),
        censusDate: new Date("2026-09-20T00:00:00Z"),
        status: "active",
      });
    });

    const course = await withTx(async (tx) => {
      return createCourse(tx, {
        code: `IMP${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "Import Testing Course",
        credits: 3,
      });
    });

    const section = await withTx(async (tx) => {
      return createSection(tx, {
        courseId: course.id,
        termId: term.id,
        code: "SEC1",
        capacity: 50,
        status: "published",
      });
    });

    const student1Email = `csv_student_1_${timestamp}@college.edu`;
    const student2Email = `csv_student_2_${timestamp}@college.edu`;
    const student1Num = `STU${timestamp}1`;
    const student2Num = `STU${timestamp}2`;

    const csvContent = [
      "name,email,role,student_number,term,section",
      `Alice Smith,${student1Email},student,${student1Num},"${term.name}",SEC1`,
      `Bob Jones,${student2Email},student,${student2Num},"${term.name}",SEC1`,
    ].join("\n");

    // 1. Dry run
    const dryRunReport = await dryRunImport(csvContent);
    expect(dryRunReport.errors.length).toBe(0);
    expect(dryRunReport.createdUsers).toBe(2);
    expect(dryRunReport.createdEnrollments).toBe(2);

    // Verify dry run wrote NOTHING to DB
    const [checkUser1] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.email, student1Email));
    expect(checkUser1).toBeUndefined();

    const [checkUser2] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.email, student2Email));
    expect(checkUser2).toBeUndefined();

    // 2. Apply import first time
    const apply1 = await withTx(async (tx) => {
      return applyImport(tx, csvContent, registrarUser.id);
    });

    expect(apply1.createdUsers).toBe(2);
    expect(apply1.createdEnrollments).toBe(2);
    expect(apply1.newInvites.length).toBe(2);

    // Verify DB has the users and enrollments
    const enrolledAfter1 = await getEnrollmentsForSectionQuery(section.id);
    expect(enrolledAfter1.length).toBe(2);

    // 3. Apply exact same file a second time -> no-op
    const apply2 = await withTx(async (tx) => {
      return applyImport(tx, csvContent, registrarUser.id);
    });

    expect(apply2.createdUsers).toBe(0);
    expect(apply2.updatedUsers).toBe(2);
    expect(apply2.createdEnrollments).toBe(0);
    expect(apply2.newInvites.length).toBe(0);

    const enrolledAfter2 = await getEnrollmentsForSectionQuery(section.id);
    expect(enrolledAfter2.length).toBe(2);
  });

  it("proves emailing 300 invites with a cap of 250 defers the remainder", async () => {
    fakeEmailProvider.clear();

    // Clean deliveries and notifications for clean daily cap verification
    await db.execute(sql`
      DELETE FROM lms.notification_deliveries;
      DELETE FROM lms.notifications;
    `);

    // Create 300 distinct user recipients
    const invites: Array<{ userId: string; inviteUrl: string; name: string }> =
      [];
    for (let i = 0; i < 300; i++) {
      const uId = uuidv7();
      await db.insert(userTable).values({
        id: uId,
        name: `Invitee ${i}`,
        email: `invitee_${i}_${Date.now()}@college.edu`,
        emailVerified: false,
      });

      invites.push({
        userId: uId,
        name: `Invitee ${i}`,
        inviteUrl: `https://test.edu/accept-invite/${uId}`,
      });
    }

    // Enqueue 300 invites
    const { enqueued } = await withTx(async (tx) => {
      return emailAllInvites(tx, invites);
    });
    expect(enqueued).toBe(300);

    // Ensure sending cap: hardCap = 250
    const hardCap = env.EMAIL_DAILY_CAP;

    // Drain jobs
    await drainJobs(30);

    const deliveries = await db.select().from(notificationDeliveriesTable);
    const sentDeliveries = deliveries.filter((d) => d.status === "sent");
    const deferredDeliveries = deliveries.filter(
      (d) => d.status === "deferred",
    );

    // The sent emails cannot exceed hardCap
    expect(sentDeliveries.length).toBeLessThanOrEqual(hardCap);
    // The rest must be deferred
    expect(deferredDeliveries.length).toBeGreaterThan(0);
    expect(sentDeliveries.length + deferredDeliveries.length).toBe(300);
  });

  it("proves faculty cannot read a section they do not teach and student cannot read another student's enrollment", async () => {
    // 1. Setup Term, Course, Section
    const term = await withTx(async (tx) => {
      return createTerm(tx, {
        name: `Authz Term - ${Date.now()}`,
        startsOn: new Date("2026-09-01T00:00:00Z"),
        endsOn: new Date("2026-12-15T00:00:00Z"),
        censusDate: new Date("2026-09-20T00:00:00Z"),
        status: "active",
      });
    });

    const course = await withTx(async (tx) => {
      return createCourse(tx, {
        code: `AUTH${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "Authorization Models",
        credits: 3,
      });
    });

    const section = await withTx(async (tx) => {
      return createSection(tx, {
        courseId: course.id,
        termId: term.id,
        code: "01",
        capacity: 25,
        status: "published",
      });
    });

    // 2. Create Faculty A and Faculty B
    const { user: facultyA, profile: profileFacultyA } =
      await createUserWithProfile({
        name: "Faculty Alice",
        email: `faculty_a_${Date.now()}@college.edu`,
        password: "TestPassword123!",
        roles: ["faculty"],
        status: "active",
      });

    const { user: facultyB, profile: profileFacultyB } =
      await createUserWithProfile({
        name: "Faculty Bob",
        email: `faculty_b_${Date.now()}@college.edu`,
        password: "TestPassword123!",
        roles: ["faculty"],
        status: "active",
      });

    // Assign only Faculty A to Section
    await withTx(async (tx) => {
      await addSectionInstructor(tx, {
        sectionId: section.id,
        userId: facultyA.id,
        role: "lead",
      });
    });

    // Faculty A actor
    const actorFacultyA: Actor = {
      userId: facultyA.id,
      email: facultyA.email,
      name: facultyA.name,
      roles: ["faculty"],
      status: "active",
      twoFactorEnabled: false,
      profile: profileFacultyA,
    };

    // Faculty B actor
    const actorFacultyB: Actor = {
      userId: facultyB.id,
      email: facultyB.email,
      name: facultyB.name,
      roles: ["faculty"],
      status: "active",
      twoFactorEnabled: false,
      profile: profileFacultyB,
    };

    // Faculty A CAN read section they teach
    const facultyACanRead = await can(actorFacultyA, "section:read", {
      sectionId: section.id,
    });
    expect(facultyACanRead).toBe(true);

    // Faculty B CANNOT read section they do not teach
    const facultyBCanRead = await can(actorFacultyB, "section:read", {
      sectionId: section.id,
    });
    expect(facultyBCanRead).toBe(false);

    // 3. Create Student 1 and Student 2
    const { user: student1, profile: profileStudent1 } =
      await createUserWithProfile({
        name: "Student One",
        email: `student_one_${Date.now()}@college.edu`,
        password: "TestPassword123!",
        roles: ["student"],
        status: "active",
      });

    const { user: student2 } = await createUserWithProfile({
      name: "Student Two",
      email: `student_two_${Date.now()}@college.edu`,
      password: "TestPassword123!",
      roles: ["student"],
      status: "active",
    });

    // Enroll both students into section
    await withTx(async (tx) => {
      await enrollStudent(tx, {
        sectionId: section.id,
        studentId: student1.id,
      });
      await enrollStudent(tx, {
        sectionId: section.id,
        studentId: student2.id,
      });
    });

    const actorStudent1: Actor = {
      userId: student1.id,
      email: student1.email,
      name: student1.name,
      roles: ["student"],
      status: "active",
      twoFactorEnabled: false,
      profile: profileStudent1,
    };

    // Student 1 CAN read their own enrollment
    const student1CanReadSelf = await can(actorStudent1, "enrollment:read", {
      userId: student1.id,
      sectionId: section.id,
    });
    expect(student1CanReadSelf).toBe(true);

    // Student 1 CANNOT read Student 2's enrollment
    const student1CanReadStudent2 = await can(
      actorStudent1,
      "enrollment:read",
      {
        userId: student2.id,
        sectionId: section.id,
      },
    );
    expect(student1CanReadStudent2).toBe(false);
  });
});
