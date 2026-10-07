import { eq } from "drizzle-orm";
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
import {
  createLesson,
  createModule,
  updateLesson,
  updateModule,
} from "@/modules/content";
import { enrollmentsTable } from "@/modules/enrollment/schema";
import { userTable } from "@/modules/identity/schema";
import { jobsTable } from "@/modules/jobs/schema";
import { sectionCompletionsTable } from "../schema";
import { recordHeartbeat } from "../service";

describe("Progress Module Integration Tests", () => {
  let facultyActor: Actor;
  let studentActor: Actor;
  let sectionId: string;
  let enrollmentId: string;
  let videoLessonId: string;
  let textLessonId: string;
  let moduleId: string;

  beforeAll(async () => {
    const facultyId = uuidv7();
    const studentId = uuidv7();

    await db.insert(userTable).values([
      {
        id: facultyId,
        name: "Prof. Progress",
        email: `prof-${facultyId}@college.test`,
      },
      {
        id: studentId,
        name: "Student Progress",
        email: `student-${studentId}@college.test`,
      },
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
      userId: facultyId,
      name: "Prof. Progress",
      email: `prof-${facultyId}@college.test`,
      roles: ["faculty", "admin"],
    });
    studentActor = makeActor({
      userId: studentId,
      name: "Student Progress",
      email: `student-${studentId}@college.test`,
      roles: ["student"],
    });

    const termId = uuidv7();
    await db.insert(termsTable).values({
      id: termId,
      name: "Fall 2026",
      startsOn: new Date("2026-09-01T00:00:00Z"),
      endsOn: new Date("2026-12-15T00:00:00Z"),
      censusDate: new Date("2026-09-15T00:00:00Z"),
      status: "active",
    });

    const courseId = uuidv7();
    await db.insert(coursesTable).values({
      id: courseId,
      code: `CS-${uuidv7().slice(-8)}`,
      title: "Operating Systems",
      credits: 4,
    });

    sectionId = uuidv7();
    await db.insert(sectionsTable).values({
      id: sectionId,
      courseId,
      termId,
      code: "01",
      capacity: 40,
      delivery: "online",
      status: "published",
    });

    enrollmentId = uuidv7();
    await db.insert(enrollmentsTable).values({
      id: enrollmentId,
      sectionId,
      studentId,
      status: "enrolled",
      source: "manual",
    });

    // Create module and published lessons
    await withTx(async (tx) => {
      const mod = await createModule(tx, facultyActor, {
        sectionId,
        title: "Module 1",
      });
      await updateModule(tx, facultyActor, {
        moduleId: mod.id,
        status: "published",
      });
      moduleId = mod.id;

      const vLesson = await createLesson(tx, facultyActor, {
        moduleId: mod.id,
        type: "video",
        title: "Kernel Architecture Video",
        estMinutes: 10, // 10 minutes = 600 seconds
        video: {
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          videoId: "dQw4w9WgXcQ",
          durationSeconds: 600,
        },
      });
      await updateLesson(tx, facultyActor, {
        lessonId: vLesson.id,
        status: "published",
      });
      videoLessonId = vLesson.id;

      const tLesson = await createLesson(tx, facultyActor, {
        moduleId: mod.id,
        type: "rich_text",
        title: "Reading: Virtual Memory",
        estMinutes: 2,
        body: {
          type: "doc",
          content: [{ type: "paragraph", text: "Text content..." }],
        },
      });
      await updateLesson(tx, facultyActor, {
        lessonId: tLesson.id,
        status: "published",
      });
      textLessonId = tLesson.id;
    });
  });

  describe("Video Intervals and Anti-Cheat Rules", () => {
    it("proves seeking to the end of a video does not complete it", async () => {
      await withTx(async (tx) => {
        // Video duration: 600s.
        // User skips straight to second 590 and watches until 600: only 10 unique seconds watched!
        const result = await recordHeartbeat(tx, studentActor, {
          lessonId: videoLessonId,
          currentPositionS: 600,
          intervals: [[590, 600]],
        });

        // Unique seconds = 10 / 600 = 1%
        expect(result.progress.progressPct).toBe(1);
        expect(result.progress.status).toBe("in_progress");
        expect(result.progress.completedAt).toBeNull();
      });
    });

    it("proves watching at least 90% of unique seconds marks the video completed", async () => {
      await withTx(async (tx) => {
        // Create an isolated fresh video lesson so prior test intervals don't skew the calculation
        const isolatedLesson = await createLesson(tx, facultyActor, {
          moduleId,
          type: "video",
          title: "Memory Paging Video",
          estMinutes: 10,
          video: {
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            videoId: "dQw4w9WgXcQ",
            durationSeconds: 600,
          },
        });
        await updateLesson(tx, facultyActor, {
          lessonId: isolatedLesson.id,
          status: "published",
        });

        // Student watches [0, 300] then [280, 560] = total coverage 560s / 600s = 93%
        const r1 = await recordHeartbeat(tx, studentActor, {
          lessonId: isolatedLesson.id,
          currentPositionS: 300,
          intervals: [[0, 300]],
        });
        expect(r1.progress.progressPct).toBe(50);
        expect(r1.progress.status).toBe("in_progress");

        const r2 = await recordHeartbeat(tx, studentActor, {
          lessonId: isolatedLesson.id,
          currentPositionS: 560,
          intervals: [[280, 560]],
        });
        expect(r2.progress.progressPct).toBe(93);
        expect(r2.progress.status).toBe("completed");
        expect(r2.progress.completedAt).not.toBeNull();
      });
    });

    it("proves progress percentage and watched coverage never decrease (monotonic)", async () => {
      await withTx(async (tx) => {
        // First watch 50%
        await recordHeartbeat(tx, studentActor, {
          lessonId: videoLessonId,
          currentPositionS: 300,
          intervals: [[0, 300]],
        });

        // Student rewinds and watches [0, 60]: incoming payload alone would be 10%, but progress must remain >= 50%
        const rewindResult = await recordHeartbeat(tx, studentActor, {
          lessonId: videoLessonId,
          currentPositionS: 60,
          intervals: [[0, 60]],
        });

        expect(rewindResult.progress.progressPct).toBeGreaterThanOrEqual(50);
      });
    });
  });

  describe("Section Completion and Certificate Guard", () => {
    it("records section completion exactly once and enqueues certificate check when all lessons are completed", async () => {
      await withTx(async (tx) => {
        // 1. Complete the video lesson
        await recordHeartbeat(tx, studentActor, {
          lessonId: videoLessonId,
          intervals: [[0, 600]],
        });

        // 2. Complete the rich text lesson
        const res = await recordHeartbeat(tx, studentActor, {
          lessonId: textLessonId,
          dwellSeconds: 60,
          isEndReached: true,
        });

        expect(res.progress.status).toBe("completed");
        expect(res.sectionCompleted).toBe(true);

        // Verify section completion row in database
        const completions = await tx
          .select()
          .from(sectionCompletionsTable)
          .where(eq(sectionCompletionsTable.enrollmentId, enrollmentId));

        expect(completions.length).toBe(1);

        // Verify certificate:check job was enqueued
        const certJobs = await tx
          .select()
          .from(jobsTable)
          .where(eq(jobsTable.name, "certificate:check"));

        expect(certJobs.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
