import { expect, test } from "@playwright/test";
import { createTestUser, signIn } from "./test-helpers";

test.describe("Shell & Responsive Navigation Gates", () => {
  test("student portal at 360x740 mobile viewport displays bottom navigation with touch targets >= 44px", async ({
    page,
  }) => {
    // 1. Create a student user
    const student = await createTestUser({
      roles: ["student"],
      name: "Mobile Student",
      emailPrefix: "shell_mobile",
    });

    // 2. Set mobile viewport: 360x740
    await page.setViewportSize({ width: 360, height: 740 });

    // 3. Sign in and navigate to /student
    await signIn(page, student.email, student.password);
    await page.goto("/student");

    // 4. Verify bottom navigation bar is visible and accessible
    const bottomNav = page.locator('nav[aria-label="Mobile Navigation"]');
    await expect(bottomNav).toBeVisible();

    // 5. Verify desktop sidebar is hidden on mobile
    const desktopSidebar = page.locator(
      'aside[aria-label="Desktop Navigation"]',
    );
    await expect(desktopSidebar).toBeHidden();

    // 6. Verify touch targets on bottom nav items are >= 44px
    const navLinks = bottomNav.locator("a");
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const box = await navLinks.nth(i).boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("portal at 1280x800 desktop viewport displays sidebar and hides bottom navigation", async ({
    page,
  }) => {
    const student = await createTestUser({
      roles: ["student"],
      name: "Desktop Student",
      emailPrefix: "shell_desktop",
    });

    // 1. Set desktop viewport: 1280x800
    await page.setViewportSize({ width: 1280, height: 800 });

    // 2. Sign in and navigate to /student
    await signIn(page, student.email, student.password);
    await page.goto("/student");

    // 3. Verify desktop sidebar is visible
    const desktopSidebar = page.locator(
      'aside[aria-label="Desktop Navigation"]',
    );
    await expect(desktopSidebar).toBeVisible();

    // 4. Verify bottom navigation is hidden on desktop
    const bottomNav = page.locator('nav[aria-label="Mobile Navigation"]');
    await expect(bottomNav).toBeHidden();
  });

  test("multi-role user can switch portals using role switcher cookie", async ({
    page,
  }) => {
    // 1. Create a user with both faculty and student roles
    const multiUser = await createTestUser({
      roles: ["faculty", "student"],
      name: "Faculty Student",
      emailPrefix: "shell_multirole",
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, multiUser.email, multiUser.password);

    // Default active role for faculty+student is faculty
    await page.goto("/faculty");
    await expect(page.locator("h1")).toContainText("Faculty Workspace");

    // 2. Verify role switcher is available
    const roleSwitcher = page.locator(
      'select[aria-label="Switch active role"]',
    );
    await expect(roleSwitcher).toBeVisible();

    // 3. Switch to student
    await roleSwitcher.selectOption("student");

    // 4. Verify redirect to /student and active cookie
    await page.waitForURL("**/student");
    await expect(page.locator("h1")).toContainText("Student Portal");

    const cookies = await page.context().cookies();
    const activeRoleCookie = cookies.find(
      (c) => c.name === "bqlms_active_role",
    );
    expect(activeRoleCookie?.value).toBe("student");
  });

  test("idle authenticated page issues no background requests for 60 seconds", async ({
    page,
  }) => {
    test.setTimeout(80000);
    const student = await createTestUser({
      roles: ["student"],
      name: "Idle Student",
      emailPrefix: "shell_idle",
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, student.email, student.password);
    await page.goto("/student");
    await page.waitForLoadState("networkidle");

    // Track any network requests during the 60-second idle period
    const backgroundRequests: string[] = [];
    page.on("request", (req) => {
      // Ignore internal browser favicon/analytics if any, record function/api requests
      const url = req.url();
      if (!url.includes("favicon.ico")) {
        backgroundRequests.push(url);
      }
    });

    // Wait 60 seconds idle (test budget check)
    await page.waitForTimeout(60000);

    expect(backgroundRequests).toEqual([]);
  });
});
