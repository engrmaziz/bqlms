import { expect, test } from "@playwright/test";
import { withTx } from "@/db/tx";
import { createCourse, createSection, createTerm } from "@/modules/academics";
import { createTestUser, signIn } from "./test-helpers";

test.describe("Registrar Academic Management & Import E2E", () => {
  test("student requesting registrar admin routes gets 404", async ({
    page,
  }) => {
    const student = await createTestUser({
      roles: ["student"],
      name: "Student Tester",
      emailPrefix: "reg_student_blocked",
    });

    await signIn(page, student.email, student.password);

    const termsRes = await page.goto("/admin/terms");
    expect(termsRes?.status()).toBe(404);

    const importRes = await page.goto("/admin/import");
    expect(importRes?.status()).toBe(404);
  });

  test("registrar accesses academic terms, courses, sections, and import pages", async ({
    page,
  }) => {
    const registrar = await createTestUser({
      roles: ["registrar"],
      name: "Registrar Jane",
      emailPrefix: "reg_officer",
    });

    await signIn(page, registrar.email, registrar.password);

    // 1. Visit /admin/terms
    await page.goto("/admin/terms");
    await expect(page.locator("h1")).toContainText(/Academic Terms|Terms/i);
    await expect(page.locator("body")).toBeVisible();

    // 2. Visit /admin/courses
    await page.goto("/admin/courses");
    await expect(page.locator("h1")).toContainText(/Courses|Course Catalog/i);
    await expect(page.locator("body")).toBeVisible();

    // 3. Create a test term and section to test section roster page
    const { term, section } = await withTx(async (tx) => {
      const t = await createTerm(tx, {
        name: `E2E Term - ${Date.now()}`,
        startsOn: new Date("2026-09-01T00:00:00Z"),
        endsOn: new Date("2026-12-15T00:00:00Z"),
        censusDate: new Date("2026-09-20T00:00:00Z"),
        status: "active",
      });
      const c = await createCourse(tx, {
        code: `E2E${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "E2E Software Engineering",
        credits: 3,
      });
      const s = await createSection(tx, {
        courseId: c.id,
        termId: t.id,
        code: "01",
        capacity: 25,
        status: "published",
      });
      return { term: t, course: c, section: s };
    });

    // 4. Visit /admin/sections
    await page.goto("/admin/sections");
    await expect(page.locator("h1")).toContainText(/Sections|Course Sections/i);

    // 5. Visit /admin/sections/[sectionId]
    await page.goto(`/admin/sections/${section.id}`);
    await expect(page.locator("h1")).toContainText(/Section 01|01/i);
    await expect(page.locator("body")).toContainText("Capacity");

    // 6. Visit /admin/import
    await page.goto("/admin/import");
    await expect(page.locator("h1")).toContainText(
      /Batch Import|Import People/i,
    );

    // Check CSV textarea or file input presence
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();

    // Enter test CSV
    const testCsv = [
      "name,email,role,student_number,term,section",
      `Test Student,test_import_${Date.now()}@college.edu,student,STU${Date.now()},"${term.name}",01`,
    ].join("\n");

    await textarea.fill(testCsv);

    // Click "Run Dry-Run Verification"
    const dryRunBtn = page.getByRole("button", { name: /dry-run|verify/i });
    await expect(dryRunBtn).toBeVisible();
    await dryRunBtn.click();

    // Verification report preview should appear
    await expect(
      page.getByText(/Dry-Run Analysis Report|Ready to Apply/i),
    ).toBeVisible({
      timeout: 10000,
    });
  });
});
