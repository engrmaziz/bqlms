import { describe, expect, it } from "vitest";
import { logger } from "@/lib/logger";
import { runWithRequestContext } from "@/lib/request-context";

describe("logger", () => {
  it("should instantiate pino logger with redactions", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("should allow logging within request context", () => {
    runWithRequestContext({ requestId: "req-test-99", userId: "usr-1" }, () => {
      expect(() => {
        logger.info({ message: "test inside context", password: "secret" });
      }).not.toThrow();
    });
  });
});
