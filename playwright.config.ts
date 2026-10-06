import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3005";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: appUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  ...(!process.env.CI
    ? {
        webServer: {
          command: "pnpm dev -p 3005",
          url: appUrl,
          reuseExistingServer: true,
          timeout: 120000,
        },
      }
    : {}),
});
