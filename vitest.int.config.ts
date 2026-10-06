import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

// Load environment variables for integration tests
dotenv.config({ path: ".env" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["tests/unit/**", "tests/e2e/**", "node_modules/**", ".next/**"],
    testTimeout: 15000,
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
