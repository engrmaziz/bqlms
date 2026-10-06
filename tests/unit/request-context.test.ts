import { describe, expect, it } from "vitest";
import {
  getRequestContext,
  runWithRequestContext,
} from "@/lib/request-context";

describe("request-context", () => {
  it("should return undefined outside context", () => {
    expect(getRequestContext()).toBeUndefined();
  });

  it("should provide context within runWithRequestContext", () => {
    const context = { requestId: "req-123", userId: "user-456" };
    runWithRequestContext(context, () => {
      const current = getRequestContext();
      expect(current).toBeDefined();
      expect(current?.requestId).toBe("req-123");
      expect(current?.userId).toBe("user-456");
    });
  });

  it("should isolate nested contexts", () => {
    runWithRequestContext({ requestId: "parent" }, () => {
      expect(getRequestContext()?.requestId).toBe("parent");
      runWithRequestContext({ requestId: "child" }, () => {
        expect(getRequestContext()?.requestId).toBe("child");
      });
      expect(getRequestContext()?.requestId).toBe("parent");
    });
  });
});
