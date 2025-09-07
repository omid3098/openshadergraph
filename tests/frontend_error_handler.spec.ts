/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { installGlobalErrorHandlers } from "@/lib/errorHandler";

describe("global error handlers", () => {
  beforeEach(() => {
    installGlobalErrorHandlers();
  });

  it("swallows null errors", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = (window.onerror as any)("", "", 0, 0, null);
    expect(res).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("propagates real errors", () => {
    const err = new Error("boom");
    const res = (window.onerror as any)("", "", 1, 1, err);
    expect(res).toBe(false);
  });
});
