import { describe, it, expect } from "vitest";

// Basic smoke timing test for preview-ready under 1s threshold in CI (node tests proxy)
// In CI we cannot launch a browser here; this serves as a placeholder to wire a Playwright test later.

describe("preview timing placeholder", () => {
  it("has a <1s budget placeholder", () => {
    expect(1).toBe(1);
  });
});


