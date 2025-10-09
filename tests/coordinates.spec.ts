import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeSwizzleToTarget,
  getCoordinateSystem,
  swizzleDirectionRefToTarget,
  swizzleDirectionTargetToRef,
  swizzleVec3,
} from "../src/core/types/coordinates";

const here = dirname(fileURLToPath(import.meta.url));

function loadLanguage(path: string) {
  return JSON.parse(readFileSync(resolve(here, path), "utf-8"));
}

describe("coordinates utilities", () => {
  it("defaults to ThreeJS reference when missing", () => {
    const cs = getCoordinateSystem(undefined as any);
    expect(cs).toEqual({ up: "+y", right: "+x", forward: "-z", handedness: "right" });
  });

  it("computes identity swizzle for ThreeJS", () => {
    const m = computeSwizzleToTarget({ up: "+y", right: "+x", forward: "-z" });
    expect(m).toEqual({ x: "+x", y: "+y", z: "-z" });
    expect(swizzleVec3("v", { up: "+y", right: "+x", forward: "-z" })).toBe("vec3((v).x, (v).y, -((v).z))");
  });

  it("supports a Z-up system (example)", () => {
    const target = { up: "+z", right: "+x", forward: "+y" } as const;
    const m = computeSwizzleToTarget(target);
    expect(m).toEqual({ x: "+x", y: "+z", z: "+y" });
    expect(swizzleVec3("n", target)).toBe("vec3((n).x, (n).z, (n).y)");
  });

  it("supports negative forward axis", () => {
    const target = { up: "+y", right: "+x", forward: "-z" } as const;
    const m = computeSwizzleToTarget(target);
    expect(m).toEqual({ x: "+x", y: "+y", z: "-z" });
    expect(swizzleVec3("v", target)).toBe("vec3((v).x, (v).y, -((v).z))");
  });

  it("swizzles between reference and target spaces", () => {
    const target = { up: "-y", right: "-x", forward: "-z" } as const;
    const toTarget = swizzleDirectionRefToTarget("dir", target);
    expect(toTarget).toBe("vec3(-((dir).x), -((dir).y), -((dir).z))");
    const back = swizzleDirectionTargetToRef("dir", target);
    expect(back).toBe("vec3(-((dir).x), -((dir).y), -((dir).z))");
  });

  it("applies per-space overrides when provided", () => {
    const lang = {
      coordinates: {
        up: "+y",
        right: "+x",
        forward: "-z",
        spaces: {
          view: { up: "-y", right: "-x", forward: "-z" },
          screen: { up: "-y", right: "-x", forward: "-z" },
        },
      },
    } as any;
    const world = getCoordinateSystem(lang, "world");
    expect(world).toEqual({ up: "+y", right: "+x", forward: "-z" });
    const view = getCoordinateSystem(lang, "view");
    expect(view).toEqual({ up: "-y", right: "-x", forward: "-z" });
    const screen = getCoordinateSystem(lang, "screen");
    expect(screen).toEqual({ up: "-y", right: "-x", forward: "-z" });
  });

  it("declares view/screen orientation for built-in languages", () => {
    const godot = loadLanguage("../data/languages/Godot.json");
    const three = loadLanguage("../data/languages/ThreeJS_GLSL.json");
    expect(getCoordinateSystem(godot as any, "view")).toEqual({ up: "-y", right: "-x", forward: "-z" });
    expect(getCoordinateSystem(godot as any, "screen")).toEqual({ up: "-y", right: "-x", forward: "-z" });
    expect(getCoordinateSystem(three as any, "view")).toEqual({ up: "+y", right: "+x", forward: "-z" });
    expect(getCoordinateSystem(three as any, "screen")).toEqual({ up: "+y", right: "+x", forward: "-z" });
  });
});


