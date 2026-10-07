import { expect, test } from "@playwright/test";
import { uuidv7 } from "uuidv7";
import { db } from "@/db/client";
import { withTx } from "@/db/tx";
import type { Actor } from "@/lib/auth/session";
import {
  coursesTable,
  sectionInstructorsTable,
  sectionsTable,
  termsTable,
} from "@/modules/academics/schema";
import {
  createLesson,
  createModule,
  publishSyllabus,
  updateLesson,
  updateModule,
} from "@/modules/content/service";
import { enrollmentsTable } from "@/modules/enrollment/schema";
import { createTestUser, signIn } from "./test-helpers";

test.describe("Course Delivery & Builder E2E", () => {
  let sectionId: string;
  let unlockedLessonId: string;
  let lockedLessonId: string;
  let facultyUser: Awaited<ReturnType<typeof createTestUser>>;
  let studentUser: Awaited<ReturnType<typeof createTestUser>>;

  test.beforeAll(async () => {
    // 1. Create faculty & student accounts
    facultyUser = await createTestUser({
      roles: ["faculty"],
      name: "Prof. Delivery E2E",
      emailPrefix: "prof_e2e",
    });

    studentUser = await createTestUser({
      roles: ["student"],
      name: "Student Delivery E2E",
      emailPrefix: "student_e2e",
    });

    // 2. Set up academic entities
    const termId = uuidv7();
    await db.insert(termsTable).values({
      id: termId,
      name: `Delivery Term ${Date.now()}`,
      startsOn: new Date("2026-09-01T00:00:00Z"),
      endsOn: new Date("2026-12-15T00:00:00Z"),
      censusDate: new Date("2026-09-20T00:00:00Z"),
      status: "active",
    });

    const courseId = uuidv7();
    await db.insert(coursesTable).values({
      id: courseId,
      code: `CS${Math.floor(Math.random() * 9000 + 1000)}`,
      title: "Distributed Systems Architecture",
      credits: 4,
    });

    sectionId = uuidv7();
    await db.insert(sectionsTable).values({
      id: sectionId,
      courseId,
      termId,
      code: "01",
      capacity: 35,
      delivery: "online",
      status: "published",
    });

    // Assign faculty to section
    await db.insert(sectionInstructorsTable).values({
      sectionId,
      userId: facultyUser.user.id,
      role: "lead",
    });

    // Enroll student in section
    await db.insert(enrollmentsTable).values({
      id: uuidv7(),
      sectionId,
      studentId: studentUser.user.id,
      status: "enrolled",
      source: "manual",
    });

    // 3. Create module and lessons
    await withTx(async (tx) => {
      const facultyActor: Actor = {
        userId: facultyUser.user.id,
        email: facultyUser.email,
        name: facultyUser.name,
        roles: ["faculty"],
        status: "active",
        twoFactorEnabled: false,
        profile: facultyUser.profile,
      };

      const mod = await createModule(tx, facultyActor, {
        sectionId,
        title: "Module 1: Foundations of Consensus",
      });
      await updateModule(tx, facultyActor, {
        moduleId: mod.id,
        status: "published",
      });

      // Unlocked lesson
      const unlocked = await createLesson(tx, facultyActor, {
        moduleId: mod.id,
        type: "rich_text",
        title: "Lesson 1: Introduction to Paxos",
        estMinutes: 5,
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Paxos is a family of protocols for solving consensus in a network of unreliable processors.",
                },
              ],
            },
          ],
        },
      });
      await updateLesson(tx, facultyActor, {
        lessonId: unlocked.id,
        status: "published",
      });
      unlockedLessonId = unlocked.id;

      // Locked lesson (locked via future fixed_date drip rule)
      const locked = await createLesson(tx, facultyActor, {
        moduleId: mod.id,
        type: "rich_text",
        title: "Lesson 2: Byzantine Fault Tolerance",
        estMinutes: 10,
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "SUPER SECRET BYZANTINE CONTENT THAT MUST NOT LEAK WHEN LOCKED",
                },
              ],
            },
          ],
        },
        dripRules: [
          {
            kind: "fixed_date",
            date: "2099-01-01T00:00:00Z",
          },
        ],
      });
      await updateLesson(tx, facultyActor, {
        lessonId: locked.id,
        status: "published",
      });
      lockedLessonId = locked.id;

      // Publish initial syllabus
      await publishSyllabus(tx, facultyActor, {
        sectionId,
        content: {
          courseGoals: "Master distributed systems and fault tolerance.",
          grading: "Quizzes 30%, Assignments 40%, Final Exam 30%",
        },
      });
    });
  });

  test("student requesting faculty builder gets 404", async ({ page }) => {
    await signIn(page, studentUser.email, studentUser.password);
    const res = await page.goto(`/faculty/sections/${sectionId}/builder`);
    expect(res?.status()).toBe(404);
  });

  test("faculty accesses builder and sees modules and checklist", async ({
    page,
  }) => {
    await signIn(page, facultyUser.email, facultyUser.password);
    await page.goto(`/faculty/sections/${sectionId}/builder`);

    await expect(page.locator("h1")).toContainText(/Course Builder/i);
    await expect(
      page.getByText("Module 1: Foundations of Consensus"),
    ).toBeVisible();
    await expect(
      page.getByText("Lesson 1: Introduction to Paxos"),
    ).toBeVisible();
    await expect(
      page.getByText("Lesson 2: Byzantine Fault Tolerance"),
    ).toBeVisible();

    // Check publish checklist section
    await expect(page.getByText(/Publish Checklist/i)).toBeVisible();
  });

  test("faculty accesses syllabus editor and views published syllabus", async ({
    page,
  }) => {
    await signIn(page, facultyUser.email, facultyUser.password);
    await page.goto(`/faculty/sections/${sectionId}/syllabus`);

    await expect(page.locator("h1")).toContainText(/Syllabus/i);
    await expect(page.getByText(/Published Version: v1/i)).toBeVisible();
    await expect(
      page.getByText("Master distributed systems and fault tolerance."),
    ).toBeVisible();
  });

  test("student views curriculum and progress summary", async ({ page }) => {
    await signIn(page, studentUser.email, studentUser.password);
    await page.goto(`/student/sections/${sectionId}`);

    await expect(page.locator("h1")).toContainText(/Course Curriculum/i);
    await expect(
      page.getByText("Module 1: Foundations of Consensus"),
    ).toBeVisible();
    await expect(
      page.getByText("Lesson 1: Introduction to Paxos"),
    ).toBeVisible();
    await expect(
      page.getByText("Lesson 2: Byzantine Fault Tolerance"),
    ).toBeVisible();

    // Lesson 2 should show locked badge
    await expect(page.getByText(/Locked/i).first()).toBeVisible();

    // Check syllabus link
    const syllabusLink = page.getByRole("link", { name: /View Syllabus/i });
    await expect(syllabusLink).toBeVisible();
    await syllabusLink.click();

    await page.waitForURL(`**/student/sections/${sectionId}/syllabus`);
    await expect(
      page.getByText("Master distributed systems and fault tolerance."),
    ).toBeVisible();
  });

  test("student accesses unlocked lesson and views content", async ({
    page,
  }) => {
    await signIn(page, studentUser.email, studentUser.password);
    await page.goto(
      `/student/sections/${sectionId}/lessons/${unlockedLessonId}`,
    );

    await expect(page.locator("h1")).toContainText(
      "Lesson 1: Introduction to Paxos",
    );
    await expect(
      page.getByText("Paxos is a family of protocols for solving consensus"),
    ).toBeVisible();
  });

  test("student accesses locked lesson and sees locked stub without secret content", async ({
    page,
  }) => {
    await signIn(page, studentUser.email, studentUser.password);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.goto(`/student/sections/${sectionId}/lessons/${lockedLessonId}`);

    // Locked heading
    await expect(
      page.getByText("Lesson 2: Byzantine Fault Tolerance"),
    ).toBeVisible();
    await expect(page.getByText(/^Available on/i)).toBeVisible();

    // Crucial security invariant: the secret body MUST NOT be in the DOM
    const bodyContent = page.getByText("SUPER SECRET BYZANTINE CONTENT");
    await expect(bodyContent).not.toBeVisible();
  });
});
