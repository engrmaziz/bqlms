import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createTestUser, signIn } from "./test-helpers";

test.describe("Accessibility (A11y) Verification Gates", () => {
  let superAdmin: Awaited<ReturnType<typeof createTestUser>>;
  let faculty: Awaited<ReturnType<typeof createTestUser>>;
  let student: Awaited<ReturnType<typeof createTestUser>>;

  test.beforeAll(async () => {
    superAdmin = await createTestUser({
      roles: ["super_admin"],
      name: "A11y Super Admin",
      emailPrefix: "a11y_admin",
    });

    faculty = await createTestUser({
      roles: ["faculty"],
      name: "A11y Professor",
      emailPrefix: "a11y_faculty",
    });

    student = await createTestUser({
      roles: ["student"],
      name: "A11y Student",
      emailPrefix: "a11y_student",
    });
  });

  test("skip link is present and targets #main-content", async ({ page }) => {
    await signIn(page, student.email, student.password);
    await page.goto("/student");

    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();
    await expect(skipLink).toHaveText(/Skip to main content/i);

    const mainContent = page.locator("#main-content");
    await expect(mainContent).toBeAttached();
  });

  test("student portal reports zero serious or critical axe violations", async ({
    page,
  }) => {
    await signIn(page, student.email, student.password);
    await page.goto("/student");

    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    expect(violations).toEqual([]);
  });

  test("faculty portal reports zero serious or critical axe violations", async ({
    page,
  }) => {
    await signIn(page, faculty.email, faculty.password);
    await page.goto("/faculty");

    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    expect(violations).toEqual([]);
  });

  test("admin dashboard reports zero serious or critical axe violations", async ({
    page,
  }) => {
    await signIn(page, superAdmin.email, superAdmin.password);
    await page.goto("/admin");

    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    expect(violations).toEqual([]);
  });

  test("admin users page reports zero serious or critical axe violations", async ({
    page,
  }) => {
    await signIn(page, superAdmin.email, superAdmin.password);
    await page.goto("/admin/users");

    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    expect(violations).toEqual([]);
  });

  test("admin settings page reports zero serious or critical axe violations", async ({
    page,
  }) => {
    await signIn(page, superAdmin.email, superAdmin.password);
    await page.goto("/admin/settings");

    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    expect(violations).toEqual([]);
  });
});
