import { describe, expect, it } from "vitest";
import { env } from "@/lib/env";

describe("env", () => {
  it("should validate and load environment variables", () => {
    expect(env).toBeDefined();
    expect(env.DATABASE_URL).toBeDefined();
    expect(env.DATABASE_URL).toContain("postgres");
    expect(env.PORT).toBeDefined();
  });
});
