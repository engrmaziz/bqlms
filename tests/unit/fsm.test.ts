import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { defineMachine } from "@/lib/fsm";

describe("fsm", () => {
  type OrderState = "draft" | "submitted" | "approved" | "rejected";
  type OrderEvent = "submit" | "approve" | "reject";

  const orderMachine = defineMachine<OrderState, OrderEvent>({
    draft: {
      submit: "submitted",
    },
    submitted: {
      approve: "approved",
      reject: "rejected",
    },
    approved: {},
    rejected: {},
  });

  it("should transition correctly on legal moves", () => {
    expect(orderMachine.transition("draft", "submit")).toBe("submitted");
    expect(orderMachine("draft", "submit")).toBe("submitted");
    expect(orderMachine.transition("submitted", "approve")).toBe("approved");
    expect(orderMachine.transition("submitted", "reject")).toBe("rejected");
  });

  it("should throw PRECONDITION_FAILED AppError on illegal moves", () => {
    try {
      orderMachine.transition("draft", "approve");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe("PRECONDITION_FAILED");
      expect(appError.status).toBe(412);
    }
  });

  it("should check can() correctly", () => {
    expect(orderMachine.can("draft", "submit")).toBe(true);
    expect(orderMachine.can("draft", "approve")).toBe(false);
    expect(orderMachine.can("approved", "submit")).toBe(false);
  });
});
