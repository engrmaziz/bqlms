import { describe, expect, it } from "vitest";
import { AppError, ERROR_CODES, ERROR_STATUS_MAP } from "@/lib/errors";

describe("errors", () => {
  it("should map each code to an HTTP status", () => {
    expect(ERROR_CODES).toHaveLength(10);
    for (const code of ERROR_CODES) {
      expect(ERROR_STATUS_MAP[code]).toBeTypeOf("number");
      expect(ERROR_STATUS_MAP[code]).toBeGreaterThanOrEqual(400);
      expect(ERROR_STATUS_MAP[code]).toBeLessThan(600);
    }
  });

  it("should create AppError with code and correct status", () => {
    const error = new AppError({
      code: "PRECONDITION_FAILED",
      message: "State cannot transition",
      details: { step: 1 },
    });

    expect(error.code).toBe("PRECONDITION_FAILED");
    expect(error.status).toBe(412);
    expect(error.message).toBe("State cannot transition");
    expect(error.details).toEqual({ step: 1 });
    expect(error.toJSON()).toEqual({
      code: "PRECONDITION_FAILED",
      message: "State cannot transition",
      status: 412,
      details: { step: 1 },
    });
  });

  it("should handle error without details in toJSON", () => {
    const error = new AppError({
      code: "UNAUTHENTICATED",
      message: "Please log in",
    });

    expect(error.code).toBe("UNAUTHENTICATED");
    expect(error.status).toBe(401);
    expect(error.toJSON()).toEqual({
      code: "UNAUTHENTICATED",
      message: "Please log in",
      status: 401,
    });
  });
});
