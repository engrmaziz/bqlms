import type { Page } from "@playwright/test";
import { uuidv7 } from "uuidv7";
import { createUserWithProfile } from "@/modules/identity";
import type { Role } from "@/modules/identity/schema";

export async function createTestUser(options: {
  roles: Role[];
  name?: string;
  emailPrefix?: string;
  password?: string;
}) {
  const emailPrefix = options.emailPrefix ?? "test_user";
  const email = `${emailPrefix}_${uuidv7()}@college.edu`;
  const password = options.password ?? "SecurePass123!";
  const name = options.name ?? `Test ${options.roles.join(" ")}`;

  const { user, profile } = await createUserWithProfile({
    name,
    email,
    password,
    roles: options.roles,
    status: "active",
  });

  return {
    user,
    profile,
    email,
    password,
    name,
  };
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.locator('[data-testid="email-input"]').fill(email);
  await page.locator('[data-testid="password-input"]').fill(password);
  await page.locator('[data-testid="submit-button"]').click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"), {
    timeout: 15000,
  });
  await page.waitForLoadState("domcontentloaded");
}
