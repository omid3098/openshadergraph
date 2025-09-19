import { describe, it, expect } from "vitest";
import { computeSwizzleToTarget, getCoordinateSystem, swizzleVec3 } from "../src/core/types/coordinates";

describe("coordinates utilities", () => {
  it("defaults to ThreeJS reference when missing", () => {
    const cs = getCoordinateSystem(undefined as any);
    expect(cs).toEqual({ up: "y", right: "x", forward: "z" });
  });

  it("computes identity swizzle for ThreeJS", () => {
    const m = computeSwizzleToTarget({ up: "+y", right: "+x", forward: "-z" });
    expect(m).toEqual({ x: "+x", y: "+y", z: "-z" });
    expect(swizzleVec3("v", { up: "+y", right: "+x", forward: "-z" })).toBe("vec3(v.x, v.y, (-v.z))");
  });

  it("supports a Z-up system (example)", () => {
    const target = { up: "+z", right: "+x", forward: "+y" } as const;
    const m = computeSwizzleToTarget(target);
    expect(m).toEqual({ x: "+x", y: "+z", z: "+y" });
    expect(swizzleVec3("n", target)).toBe("vec3(n.x, n.z, n.y)");
  });

  it("supports negative forward axis", () => {
    const target = { up: "+y", right: "+x", forward: "-z" } as const;
    const m = computeSwizzleToTarget(target);
    expect(m).toEqual({ x: "+x", y: "+y", z: "-z" });
    expect(swizzleVec3("v", target)).toBe("vec3(v.x, v.y, (-v.z))");
  });
});


