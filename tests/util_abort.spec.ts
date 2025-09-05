import { describe, it, expect } from "vitest";
import { isAbortError } from "../src/lib/errors";

describe("isAbortError utility", () => {
  it("detects DOM-like AbortError by name", () => {
    const err = { name: "AbortError", message: "The operation was aborted" } as any;
    expect(isAbortError(err)).toBe(true);
  });

  it("detects Bun/Fetch abort message variants", () => {
    const err = new Error("signal is aborted without reason");
    expect(isAbortError(err)).toBe(true);
  });

  it("returns false for regular errors", () => {
    const err = new Error("network failed");
    expect(isAbortError(err)).toBe(false);
  });
});

