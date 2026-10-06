import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
  err,
  isErr,
  isOk,
  map,
  mapErr,
  ok,
  unwrap,
  unwrapOr,
} from "@/lib/result";

describe("result", () => {
  it("should create ok result", () => {
    const res = ok(123);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toBe(123);
    }
    expect(isOk(res)).toBe(true);
    expect(isErr(res)).toBe(false);
  });

  it("should create err result", () => {
    const appErr = new AppError({
      code: "NOT_FOUND",
      message: "Resource not found",
    });
    const res = err(appErr);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe(appErr);
    }
    expect(isOk(res)).toBe(false);
    expect(isErr(res)).toBe(true);
  });

  it("should map ok values", () => {
    const res = ok(10);
    const mapped = map(res, (n) => n * 2);
    expect(unwrap(mapped)).toBe(20);
  });

  it("should map err values", () => {
    const res = err("original");
    const mapped = mapErr(res, (e) => `mapped-${e}`);
    expect(mapped).toEqual({ ok: false, error: "mapped-original" });
  });

  it("should unwrap ok or throw err", () => {
    expect(unwrap(ok("hello"))).toBe("hello");

    const appErr = new AppError({ code: "INTERNAL", message: "fail" });
    expect(() => unwrap(err(appErr))).toThrow("fail");
  });

  it("should unwrapOr with fallback", () => {
    expect(unwrapOr(ok("hello"), "fallback")).toBe("hello");
    expect(unwrapOr(err("error"), "fallback")).toBe("fallback");
  });
});
