import { describe, expect, it } from "vitest";
import { withTx } from "@/db/tx";
import { AppError } from "@/lib/errors";
import { createUserWithProfile } from "@/modules/identity";
import {
  addSectionInstructor,
  addSectionSchedule,
  createCourse,
  createHoliday,
  createSection,
  createTerm,
  deleteHoliday,
  getCourseById,
  getCoursesQuery,
  getHolidaysQuery,
  getSectionById,
  getSectionDetailsQuery,
  getSectionsQuery,
  getTermById,
  getTermsQuery,
  listInstructorsForSection,
  listSchedulesForSection,
  removeInstructor,
  removeSectionSchedule,
  updateCourse,
  updateSection,
  updateTerm,
} from "..";

describe("Academics Module Integration Tests", () => {
  it("creates, validates, and manages terms", async () => {
    const startsOn = new Date("2026-09-01T00:00:00Z");
    const endsOn = new Date("2026-12-15T00:00:00Z");
    const censusDate = new Date("2026-09-20T00:00:00Z");

    // Valid creation
    const term = await withTx(async (tx) => {
      return createTerm(tx, {
        name: `Fall 2026 - ${Date.now()}`,
        startsOn,
        endsOn,
        censusDate,
        status: "planned",
      });
    });

    expect(term.id).toBeDefined();
    expect(term.status).toBe("planned");

    // Invalid: startsOn >= endsOn
    await expect(
      withTx(async (tx) =>
        createTerm(tx, {
          name: "Invalid Term 1",
          startsOn: endsOn,
          endsOn: startsOn,
          censusDate,
        }),
      ),
    ).rejects.toThrowError(AppError);

    // Invalid: censusDate after endsOn
    await expect(
      withTx(async (tx) =>
        createTerm(tx, {
          name: "Invalid Term 2",
          startsOn,
          endsOn,
          censusDate: new Date("2027-01-01T00:00:00Z"),
        }),
      ),
    ).rejects.toThrowError(AppError);

    // Update status to active then closed
    const updatedTerm = await withTx(async (tx) => {
      return updateTerm(tx, term.id, { status: "active" });
    });
    expect(updatedTerm.status).toBe("active");

    const fetched = await getTermById(term.id);
    expect(fetched?.status).toBe("active");

    const list = await getTermsQuery();
    expect(list.some((t) => t.id === term.id)).toBe(true);
  });

  it("creates, updates, and validates courses with unique code", async () => {
    const courseCode = `CS${Math.floor(Math.random() * 9000 + 1000)}`;

    const course = await withTx(async (tx) => {
      return createCourse(tx, {
        code: courseCode,
        title: "Introduction to Computer Science",
        credits: 3,
      });
    });

    expect(course.code).toBe(courseCode);
    expect(course.credits).toBe(3);

    // Duplicate code must be rejected
    await expect(
      withTx(async (tx) =>
        createCourse(tx, {
          code: courseCode.toLowerCase(), // case-insensitive check
          title: "Duplicate Course",
          credits: 4,
        }),
      ),
    ).rejects.toThrowError(AppError);

    // Update course
    const updated = await withTx(async (tx) => {
      return updateCourse(tx, course.id, {
        title: "Introduction to CS (Honors)",
        credits: 4,
      });
    });

    expect(updated.title).toBe("Introduction to CS (Honors)");
    expect(updated.credits).toBe(4);

    const fetched = await getCourseById(course.id);
    expect(fetched?.title).toBe("Introduction to CS (Honors)");

    const allCourses = await getCoursesQuery();
    expect(allCourses.some((c) => c.id === course.id)).toBe(true);
  });

  it("creates, validates, and manages sections, instructors, and schedules", async () => {
    const term = await withTx(async (tx) => {
      return createTerm(tx, {
        name: `Spring Section Term - ${Date.now()}`,
        startsOn: new Date("2027-01-10T00:00:00Z"),
        endsOn: new Date("2027-05-15T00:00:00Z"),
        censusDate: new Date("2027-01-25T00:00:00Z"),
      });
    });

    const course = await withTx(async (tx) => {
      return createCourse(tx, {
        code: `MATH${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "Calculus I",
        credits: 4,
      });
    });

    // Valid section
    const section = await withTx(async (tx) => {
      return createSection(tx, {
        courseId: course.id,
        termId: term.id,
        code: "01",
        capacity: 35,
        delivery: "in_person",
        status: "draft",
      });
    });

    expect(section.capacity).toBe(35);
    expect(section.status).toBe("draft");

    // Invalid capacity <= 0
    await expect(
      withTx(async (tx) =>
        createSection(tx, {
          courseId: course.id,
          termId: term.id,
          code: "02",
          capacity: 0,
        }),
      ),
    ).rejects.toThrowError(AppError);

    // Update section to published
    const updatedSection = await withTx(async (tx) => {
      return updateSection(tx, section.id, {
        status: "published",
        capacity: 40,
      });
    });
    expect(updatedSection.status).toBe("published");
    expect(updatedSection.capacity).toBe(40);

    const sectionsForTerm = await getSectionsQuery({ termId: term.id });
    expect(sectionsForTerm.some((s) => s.id === section.id)).toBe(true);

    const detail = await getSectionDetailsQuery(section.id);
    expect(detail?.course.id).toBe(course.id);
    expect(detail?.term.id).toBe(term.id);

    const sectionRow = await getSectionById(section.id);
    expect(sectionRow?.courseId).toBe(course.id);

    // Instructors
    const { user: instructorUser } = await createUserWithProfile({
      name: "Professor Calculus",
      email: `prof_calc_${Date.now()}@college.edu`,
      password: "TestPassword123!",
      roles: ["faculty"],
      status: "active",
    });

    const assignment = await withTx(async (tx) => {
      return addSectionInstructor(tx, {
        sectionId: section.id,
        userId: instructorUser.id,
        role: "lead",
      });
    });
    expect(assignment.role).toBe("lead");

    const instructors = await listInstructorsForSection(section.id);
    expect(instructors.some((inst) => inst.userId === instructorUser.id)).toBe(
      true,
    );

    // Schedules
    const schedule = await withTx(async (tx) => {
      return addSectionSchedule(tx, {
        sectionId: section.id,
        weekday: 1, // Monday
        startTime: "09:00",
        endTime: "10:30",
        room: "Science Hall 101",
      });
    });
    expect(schedule.room).toBe("Science Hall 101");

    // Invalid schedule time format
    await expect(
      withTx(async (tx) =>
        addSectionSchedule(tx, {
          sectionId: section.id,
          weekday: 3,
          startTime: "9am",
          endTime: "10:30",
        }),
      ),
    ).rejects.toThrowError(AppError);

    // Invalid schedule: startTime >= endTime
    await expect(
      withTx(async (tx) =>
        addSectionSchedule(tx, {
          sectionId: section.id,
          weekday: 3,
          startTime: "11:00",
          endTime: "10:00",
        }),
      ),
    ).rejects.toThrowError(AppError);

    const schedules = await listSchedulesForSection(section.id);
    expect(schedules.some((s) => s.id === schedule.id)).toBe(true);

    // Cleanup schedule & instructor
    await withTx(async (tx) => {
      await removeSectionSchedule(tx, schedule.id);
      await removeInstructor(tx, section.id, instructorUser.id);
    });

    const remainingInst = await listInstructorsForSection(section.id);
    expect(remainingInst.length).toBe(0);
  });

  it("creates, queries, and deletes holidays", async () => {
    const holidayDate = new Date("2026-11-26T00:00:00Z");
    const holiday = await withTx(async (tx) => {
      return createHoliday(tx, {
        name: `Thanksgiving Break - ${Date.now()}`,
        date: holidayDate,
      });
    });

    expect(holiday.name).toContain("Thanksgiving Break");

    const list = await getHolidaysQuery();
    expect(list.some((h) => h.id === holiday.id)).toBe(true);

    await withTx(async (tx) => {
      await deleteHoliday(tx, holiday.id);
    });

    const afterDelete = await getHolidaysQuery();
    expect(afterDelete.some((h) => h.id === holiday.id)).toBe(false);
  });
});
