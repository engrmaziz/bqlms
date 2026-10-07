import { uuidv7 } from "uuidv7";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { withTx } from "@/db/tx";
import type { Actor } from "@/lib/auth/session";
import {
  coursesTable,
  sectionsTable,
  termsTable,
} from "@/modules/academics/schema";
import { enrollmentsTable } from "@/modules/enrollment/schema";
import { filesTable } from "@/modules/files/schema";
import { userTable } from "@/modules/identity/schema";
import {
  canAccessLessonFile,
  getLessonForStudent,
  getSectionCurriculum,
} from "../queries";
import {
  cloneSection,
  createLesson,
  createModule,
  publishSyllabus,
  updateLesson,
} from "../service";

describe("Content Module Integration Tests", () => {
  let facultyUser: { id: string; email: string };
  let studentUser: { id: string; email: string };
  let facultyActor: Actor;
  let studentActor: Actor;
  let termId: string;
  let courseId: string;
  let sectionId: string;
  let enrollmentId: string;

  beforeAll(async () => {
    // 1. Create faculty and student users
    const fId = uuidv7();
    const sId = uuidv7();
    facultyUser = { id: fId, email: `faculty-${fId}@college.test` };
    studentUser = { id: sId, email: `student-${sId}@college.test` };

    await db.insert(userTable).values([
      { id: facultyUser.id, name: "Dr. Faculty", email: facultyUser.email },
      { id: studentUser.id, name: "Jane Student", email: studentUser.email },
    ]);

    function makeActor(overrides: Partial<Actor> & { userId: string }): Actor {
      return {
        email: `${overrides.userId}@college.test`,
        name: "Test User",
        roles: ["student"],
        status: "active",
        twoFactorEnabled: false,
        profile: {
          userId: overrides.userId,
          roles: overrides.roles ?? ["student"],
          status: overrides.status ?? "active",
          studentNumber: null,
          employeeId: null,
          phone: null,
          createdAt: new Date(),
        },
        ...overrides,
      };
    }

    facultyActor = makeActor({
      userId: facultyUser.id,
      email: facultyUser.email,
      name: "Dr. Faculty",
      roles: ["faculty", "admin"],
    });

    studentActor = makeActor({
      userId: studentUser.id,
      email: studentUser.email,
      name: "Jane Student",
      roles: ["student"],
    });

    // 2. Create term and course
    termId = uuidv7();
    await db.insert(termsTable).values({
      id: termId,
      name: `Spring 2026 ${termId.slice(0, 8)}`,
      startsOn: new Date("2026-03-01T00:00:00Z"),
      endsOn: new Date("2026-06-30T00:00:00Z"),
      censusDate: new Date("2026-03-15T00:00:00Z"),
      status: "active",
    });

    courseId = uuidv7();
    await db.insert(coursesTable).values({
      id: courseId,
      code: `CS-${uuidv7().slice(-8)}`,
      title: "Data Structures & Algorithms",
      credits: 4,
    });

    // 3. Create section
    sectionId = uuidv7();
    await db.insert(sectionsTable).values({
      id: sectionId,
      courseId,
      termId,
      code: "01",
      capacity: 30,
      delivery: "online",
      status: "published",
    });

    // 4. Enroll student
    enrollmentId = uuidv7();
    await db.insert(enrollmentsTable).values({
      id: enrollmentId,
      sectionId,
      studentId: studentUser.id,
      status: "enrolled",
      source: "manual",
    });
  });

  it("proves prerequisite cycles are rejected upon lesson creation or update", async () => {
    await withTx(async (tx) => {
      // Create a module
      const mod = await createModule(tx, facultyActor, {
        sectionId,
        title: "Module 1",
      });

      // Create Lesson A
      const lessonA = await createLesson(tx, facultyActor, {
        moduleId: mod.id,
        type: "rich_text",
        title: "Lesson A",
      });

      // Create Lesson B depending on Lesson A
      const lessonB = await createLesson(tx, facultyActor, {
        moduleId: mod.id,
        type: "rich_text",
        title: "Lesson B",
        dripRules: [
          { kind: "after_completion", lessonIds: [lessonA.id], require: "all" },
        ],
      });

      // Updating Lesson A to depend on Lesson B creates a direct cycle: A -> B -> A
      await expect(
        updateLesson(tx, facultyActor, {
          lessonId: lessonA.id,
          dripRules: [
            {
              kind: "after_completion",
              lessonIds: [lessonB.id],
              require: "all",
            },
          ],
        }),
      ).rejects.toThrow(/cycle detected/i);
    });
  });

  it("proves a direct fetch of a locked lesson returns a stub and file route denies access", async () => {
    await withTx(async (tx) => {
      const mod = await createModule(tx, facultyActor, {
        sectionId,
        title: "Drip Locked Module",
      });

      // Create a private file attached to the lesson
      const fileId = uuidv7();
      await tx.insert(filesTable).values({
        id: fileId,
        ownerId: facultyUser.id,
        purpose: "lesson_document",
        delivery: "signed",
        status: "verified",
        declaredMime: "application/pdf",
        detectedMime: "application/pdf",
        sizeBytes: 1024 * 100,
        storageKey: `lesson_document/${fileId}/syllabus.pdf`,
      });

      // Create lesson locked by future date (e.g. year 2099)
      const futureDate = "2099-01-01T00:00:00Z";
      const lockedLesson = await createLesson(tx, facultyActor, {
        moduleId: mod.id,
        type: "file",
        title: "Future Final Exam",
        fileId,
        dripRules: [{ kind: "fixed_date", date: futureDate }],
      });

      // 1. Direct fetch as student MUST return stub
      const studentView = await getLessonForStudent(
        lockedLesson.id,
        studentActor,
        tx,
      );

      expect(studentView.isLocked).toBe(true);
      expect(studentView.title).toBe("Future Final Exam");
      expect(studentView.body).toBeNull();
      expect(studentView.fileId).toBeNull();
      expect(studentView.file).toBeNull();
      expect(studentView.video).toBeNull();
      expect(studentView.unlocksAt).toBeDefined();

      // 2. canAccessLessonFile MUST deny access
      const fileAllowed = await canAccessLessonFile(fileId, studentActor, tx);
      expect(fileAllowed).toBe(false);

      // Instructors however are allowed
      const instructorAllowed = await canAccessLessonFile(
        fileId,
        facultyActor,
        tx,
      );
      expect(instructorAllowed).toBe(true);
    });
  });

  it("proves section cloning duplicates structure, re-bases drip dates, and maps prerequisite IDs in one transaction", async () => {
    await withTx(async (tx) => {
      // 1. Create a complete curriculum structure in source section
      const mod = await createModule(tx, facultyActor, {
        sectionId,
        title: "Unit 1: Fundamentals",
      });

      const l1 = await createLesson(tx, facultyActor, {
        moduleId: mod.id,
        type: "rich_text",
        title: "Intro Lecture",
        dripRules: [{ kind: "fixed_date", date: "2026-03-05T00:00:00Z" }],
      });

      const l2 = await createLesson(tx, facultyActor, {
        moduleId: mod.id,
        type: "rich_text",
        title: "Advanced Topics",
        dripRules: [
          { kind: "after_completion", lessonIds: [l1.id], require: "all" },
        ],
      });

      // 2. Clone to a target term with 14 days shift
      const targetTermId = uuidv7();
      await tx.insert(termsTable).values({
        id: targetTermId,
        name: "Summer 2026",
        startsOn: new Date("2026-06-01T00:00:00Z"),
        endsOn: new Date("2026-08-31T00:00:00Z"),
        censusDate: new Date("2026-06-10T00:00:00Z"),
        status: "planned",
      });

      const clonedSection = await cloneSection(tx, facultyActor, {
        sourceSectionId: sectionId,
        targetTermId,
        targetCode: "02-CLONE",
        termStartDateShiftDays: 14,
      });

      expect(clonedSection.id).not.toBe(sectionId);
      expect(clonedSection.code).toBe("02-CLONE");

      // Verify cloned curriculum
      const clonedCurriculum = await getSectionCurriculum(
        clonedSection.id,
        facultyActor,
        {},
        tx,
      );

      if (!clonedCurriculum.isInstructor) {
        throw new Error("Expected instructor curriculum");
      }

      expect(clonedCurriculum.modules.length).toBeGreaterThanOrEqual(1);
      const clonedMod = clonedCurriculum.modules.find(
        (m) => m.title === "Unit 1: Fundamentals",
      );
      expect(clonedMod).toBeDefined();
      expect(clonedMod?.lessons.length).toBe(2);

      const clonedL1 = clonedMod?.lessons.find(
        (l) => l.title === "Intro Lecture",
      );
      const clonedL2 = clonedMod?.lessons.find(
        (l) => l.title === "Advanced Topics",
      );

      expect(clonedL1?.id).not.toBe(l1.id);
      expect(clonedL2?.id).not.toBe(l2.id);

      // Verify rebased fixed_date (shifted by 14 days = 14 * 86400000 ms)
      const l1Rule = clonedL1?.dripRules[0];
      expect(l1Rule?.kind).toBe("fixed_date");
      if (l1Rule?.kind === "fixed_date") {
        expect(l1Rule.date).toBe("2026-03-19T00:00:00.000Z");
      }

      // Verify remapped prerequisite ID: cloned L2 must depend on cloned L1, NOT original L1!
      const l2Rule = clonedL2?.dripRules[0];
      expect(l2Rule?.kind).toBe("after_completion");
      if (l2Rule?.kind === "after_completion") {
        expect(l2Rule.lessonIds).toEqual([clonedL1?.id]);
      }
    });
  });

  it("proves syllabus publishing increments versions immutably", async () => {
    await withTx(async (tx) => {
      const v1 = await publishSyllabus(tx, facultyActor, {
        sectionId,
        content: { type: "doc", text: "Version 1 content" },
      });
      expect(v1.version).toBe(1);

      const v2 = await publishSyllabus(tx, facultyActor, {
        sectionId,
        content: { type: "doc", text: "Version 2 content" },
      });
      expect(v2.version).toBe(2);
      expect(v2.id).not.toBe(v1.id);
    });
  });
});
