import type { LanguagePack } from "../schema/types";

export type Axis = "x" | "y" | "z";
export type SignedAxis = Axis | "+x" | "+y" | "+z" | "-x" | "-y" | "-z";

export type CoordinateSystem = {
  up: SignedAxis;
  right: SignedAxis;
  forward: SignedAxis;
  handedness?: "right" | "left";
};

export function getCoordinateSystem(lang: LanguagePack | undefined): CoordinateSystem {
  const coords = lang?.coordinates;
  return coords && isValidCoordinates(coords)
    ? coords
    : { up: "y", right: "x", forward: "z" };
}

export function isValidCoordinates(c: any): c is CoordinateSystem {
  if (!c || typeof c !== "object") return false;
  const axes: SignedAxis[] = [c.up, c.right, c.forward];
  if (!axes.every((a) => a === "x" || a === "+x" || a === "-x" || a === "y" || a === "+y" || a === "-y" || a === "z" || a === "+z" || a === "-z")) return false;
  const abs = axes.map((a) => (a.startsWith("-") || a.startsWith("+") ? (a.slice(1) as Axis) : a)) as Axis[];
  return new Set(abs).size === 3;
}

export type SwizzleMapping = {
  x: SignedAxis;
  y: SignedAxis;
  z: SignedAxis;
};

// Compute mapping from reference (ThreeJS) axes to target language axes.
// The reference is fixed to { up: 'y', right: 'x', forward: 'z' }.
// Returns how to read a vec3 in the target to match reference semantics.
export function computeSwizzleToTarget(target: CoordinateSystem): SwizzleMapping {
  // Reference basis vectors expressed in target axes
  // ref.x (right) equals target.right, etc.
  const map: SwizzleMapping = {
    x: target.right,
    y: target.up,
    z: target.forward,
  };
  return map;
}

// Given an expression for a vec3 in reference space, return a string that swizzles
// or reorders components to match the target coordinate system.
export function swizzleVec3(expr: string, target: CoordinateSystem): string {
  const m = computeSwizzleToTarget(target);
  const parts: string[] = [];
  for (const comp of [m.x, m.y, m.z]) {
    if (comp.startsWith("-")) {
      parts.push(`(-${expr}.${comp.slice(1)})`);
    } else if (comp.startsWith("+")) {
      parts.push(`${expr}.${comp.slice(1)}`);
    } else {
      parts.push(`${expr}.${comp}`);
    }
  }
  // If no signs and identity order, return expr directly
  if (m.x === "x" && m.y === "y" && m.z === "z") return expr;
  return `vec3(${parts.join(", ")})`;
}

const REFERENCE: CoordinateSystem = { up: "+y", right: "+x", forward: "-z", handedness: "right" };

function coordsEqual(a: CoordinateSystem, b: CoordinateSystem): boolean {
  return a.up === b.up && a.right === b.right && a.forward === b.forward;
}

// Swizzle a direction vector authored in the ThreeJS reference space into target space.
// For targets that match the reference (ThreeJS/Godot), this is identity.
export function swizzleDirectionRefToTarget(expr: string, target: CoordinateSystem): string {
  if (coordsEqual(target, REFERENCE)) return expr;
  return swizzleVec3(expr, target);
}


