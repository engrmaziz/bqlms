import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

// Load environment variables for unit tests
dotenv.config({ path: ".env" });

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "tests/unit/**/*.test.ts",
    ],
    exclude: [
      "**/*.int.test.ts",
      "tests/integration/**",
      "tests/e2e/**",
      "node_modules/**",
      ".next/**",
    ],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "server-only": path.resolve(
        import.meta.dirname,
        "./node_modules/server-only/empty.js",
      ),
    },
  },
});
