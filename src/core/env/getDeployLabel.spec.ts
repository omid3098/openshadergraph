import { describe, expect, it } from "vitest";
import { getDeployLabel } from "./getDeployLabel";

describe("getDeployLabel", () => {
  it("returns Local when DEPLOY is missing", () => {
    expect(getDeployLabel({})).toBe("Local");
  });

  it("trims and returns the provided label", () => {
    expect(getDeployLabel({ DEPLOY: "  beta  " })).toBe("beta");
  });

  it("falls back to Local for empty strings", () => {
    expect(getDeployLabel({ DEPLOY: "   " })).toBe("Local");
  });
});
