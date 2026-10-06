import { expect, test } from "@playwright/test";
import { uuidv7 } from "uuidv7";
import {
  createInvitation,
  createPasswordResetLink,
  createUserWithProfile,
  setUserSuspendedStatus,
} from "@/modules/identity";

test.describe("Authentication and Identity E2E Gates", () => {
  let adminUserId: string;

  test.beforeAll(async () => {
    const adminEmail = `e2e_admin_${uuidv7()}@college.edu`;
    const { user } = await createUserWithProfile({
      name: "E2E Administrator",
      email: adminEmail,
      password: "SuperSecretAdmin123!",
      roles: ["super_admin", "admin"],
      status: "active",
    });
    adminUserId = user.id;
  });

  test("sign-up endpoint is closed", async ({ request }) => {
    // Attempt public sign-up via Better Auth endpoint
    const response = await request.post("/api/auth/sign-up/email", {
      data: {
        email: "unauthorized_signup@college.edu",
        password: "UnauthorizedPassword123!",
        name: "Unauthorized Hacker",
      },
    });

    // Should be rejected because public signup is disabled
    expect(response.status()).toBeGreaterThanOrEqual(400);
    const body = await response.json().catch(() => ({}));
    const isClosed =
      response.status() >= 400 ||
      Boolean(body.message?.includes("disabled")) ||
      Boolean(body.code?.includes("SIGN_UP_DISABLED"));
    expect(isClosed).toBe(true);
  });

  test("CSP header carries a nonce and strict-dynamic", async ({ page }) => {
    const response = await page.goto("/sign-in");
    expect(response).not.toBeNull();
    const csp = response?.headers()["content-security-policy"] || "";
    expect(csp).toContain("nonce-");
    expect(csp).toContain("'strict-dynamic'");
  });

  test("invite link -> set password -> sign in", async ({ page }) => {
    const email = `new_student_${Date.now()}@college.edu`;
    const password = "NewStudentPass123!";

    const { inviteUrl } = await createInvitation({
      email,
      roles: ["student"],
      createdBy: adminUserId,
    });

    // 1. Visit invite link
    await page.goto(inviteUrl);
    await expect(page.locator("h1")).toContainText("Accept Invitation");

    // 2. Fill name and password
    await page.locator('[data-testid="name-input"]').fill("Sarah Connor");
    await page.locator('[data-testid="password-input"]').fill(password);
    await page.locator('[data-testid="confirm-password-input"]').fill(password);
    await page.locator('[data-testid="submit-button"]').click();

    // 3. User should be redirected to dashboard or sign-in
    await page.waitForURL(
      (url) =>
        url.pathname.includes("/dashboard") ||
        url.pathname.includes("/sign-in"),
    );

    if (page.url().includes("/sign-in")) {
      // Sign in manually if auto sign-in was bypassed
      await page.locator('[data-testid="email-input"]').fill(email);
      await page.locator('[data-testid="password-input"]').fill(password);
      await page.locator('[data-testid="submit-button"]').click();
      await page.waitForURL("**/dashboard");
    }

    await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="actor-welcome"]')).toContainText(
      "Sarah Connor",
    );
  });

  test("reused and expired invite tokens fail", async ({ page }) => {
    const email = `reused_invite_${Date.now()}@college.edu`;

    const { inviteUrl } = await createInvitation({
      email,
      roles: ["student"],
      createdBy: adminUserId,
    });

    // Accept once
    await page.goto(inviteUrl);
    await page.locator('[data-testid="name-input"]').fill("Reused Tester");
    await page.locator('[data-testid="password-input"]').fill("Password123!");
    await page
      .locator('[data-testid="confirm-password-input"]')
      .fill("Password123!");
    await page.locator('[data-testid="submit-button"]').click();

    await page.waitForURL(
      (url) =>
        url.pathname.includes("/dashboard") ||
        url.pathname.includes("/sign-in"),
    );

    // Try accepting again with the same token
    await page.goto(inviteUrl);
    await page.locator('[data-testid="name-input"]').fill("Second Attempt");
    await page.locator('[data-testid="password-input"]').fill("Password123!");
    await page
      .locator('[data-testid="confirm-password-input"]')
      .fill("Password123!");
    await page.locator('[data-testid="submit-button"]').click();

    await expect(page.locator('[data-testid="error-alert"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-alert"]')).toContainText(
      /already been accepted|invalid/i,
    );

    // Expired invite test
    const { inviteUrl: expiredUrl } = await createInvitation({
      email: `expired_${Date.now()}@college.edu`,
      roles: ["faculty"],
      createdBy: adminUserId,
      expiresInDays: -1,
    });

    await page.goto(expiredUrl);
    await page.locator('[data-testid="name-input"]').fill("Expired Tester");
    await page.locator('[data-testid="password-input"]').fill("Password123!");
    await page
      .locator('[data-testid="confirm-password-input"]')
      .fill("Password123!");
    await page.locator('[data-testid="submit-button"]').click();

    await expect(page.locator('[data-testid="error-alert"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-alert"]')).toContainText(
      /expired/i,
    );
  });

  test("admin-generated reset link works once", async ({ page }) => {
    const email = `reset_target_${Date.now()}@college.edu`;
    const initialPassword = "OldPassword123!";
    const newPassword = "BrandNewSecretPassword123!";

    const { user } = await createUserWithProfile({
      name: "Reset Candidate",
      email,
      password: initialPassword,
      roles: ["student"],
    });

    const { resetUrl } = await createPasswordResetLink({
      userId: user.id,
      createdBy: adminUserId,
      expiresInMinutes: 60,
    });

    // 1. Visit reset link
    await page.goto(resetUrl);
    await expect(page.locator("h1")).toContainText("Reset Password");

    // 2. Set new password
    await page.locator('[data-testid="password-input"]').fill(newPassword);
    await page
      .locator('[data-testid="confirm-password-input"]')
      .fill(newPassword);
    await page.locator('[data-testid="submit-button"]').click();

    // 3. Must redirect to sign-in
    await page.waitForURL("**/sign-in?reset=success");

    // 4. Sign in with the new password
    await page.locator('[data-testid="email-input"]').fill(email);
    await page.locator('[data-testid="password-input"]').fill(newPassword);
    await page.locator('[data-testid="submit-button"]').click();

    await page.waitForURL("**/dashboard");
    await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();

    // 5. Try using the reset link a second time -> must fail
    await page.goto(resetUrl);
    await page
      .locator('[data-testid="password-input"]')
      .fill("AnotherPassword123!");
    await page
      .locator('[data-testid="confirm-password-input"]')
      .fill("AnotherPassword123!");
    await page.locator('[data-testid="submit-button"]').click();

    await expect(page.locator('[data-testid="error-alert"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-alert"]')).toContainText(
      /already been used|invalid/i,
    );
  });

  test("a suspended user is rejected", async ({ page }) => {
    const email = `suspended_${Date.now()}@college.edu`;
    const password = "ValidPassword123!";

    const { user } = await createUserWithProfile({
      name: "Suspended User",
      email,
      password,
      roles: ["student"],
    });

    // Suspend user
    await setUserSuspendedStatus(user.id, true);

    // Try to access dashboard directly -> redirected to sign-in
    await page.goto("/dashboard");
    await page.waitForURL("**/sign-in?callbackUrl=%2Fdashboard");

    // Attempt to sign in -> actor resolution rejects suspended users
    await page.locator('[data-testid="email-input"]').fill(email);
    await page.locator('[data-testid="password-input"]').fill(password);
    await page.locator('[data-testid="submit-button"]').click();

    // Protected dashboard remains inaccessible
    await page.goto("/dashboard");
    await page.waitForURL("**/sign-in**");
  });

  test("an absolute callbackUrl is ignored", async ({ page }) => {
    const email = `safe_redirect_${Date.now()}@college.edu`;
    const password = "SafePassword123!";

    await createUserWithProfile({
      name: "Safe Redirect User",
      email,
      password,
      roles: ["student"],
    });

    // Attempt sign in with external phishing callbackUrl
    await page.goto("/sign-in?callbackUrl=https://evil.com/steal-creds");

    await page.locator('[data-testid="email-input"]').fill(email);
    await page.locator('[data-testid="password-input"]').fill(password);
    await page.locator('[data-testid="submit-button"]').click();

    // Must be redirected to safe default /dashboard, never evil.com
    await page.waitForURL(
      (url) =>
        !url.href.includes("evil.com") && url.pathname.includes("/dashboard"),
    );
    expect(page.url()).not.toContain("evil.com");
  });
});
