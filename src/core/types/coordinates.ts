import type { CoordinateSpace, LanguagePack } from "../schema/types";

export type Axis = "x" | "y" | "z";
export type SignedAxis = Axis | "+x" | "+y" | "+z" | "-x" | "-y" | "-z";

export type CoordinateSystem = {
  up: SignedAxis;
  right: SignedAxis;
  forward: SignedAxis;
  handedness?: "right" | "left";
};

export type CoordinateConfig = CoordinateSystem & {
  spaces?: Partial<Record<CoordinateSpace, CoordinateSystem>>;
};

const DEFAULT_COORDS: CoordinateSystem = { up: "+y", right: "+x", forward: "-z", handedness: "right" };

function stripSpaces(config: CoordinateSystem): CoordinateSystem {
  const { up, right, forward, handedness } = config;
  return handedness ? { up, right, forward, handedness } : { up, right, forward };
}

export function isValidCoordinates(c: any): c is CoordinateSystem {
  if (!c || typeof c !== "object") return false;
  const axes: SignedAxis[] = [c.up, c.right, c.forward];
  if (
    !axes.every(
      (a) => a === "x" || a === "+x" || a === "-x" || a === "y" || a === "+y" || a === "-y" || a === "z" || a === "+z" || a === "-z"
    )
  ) {
    return false;
  }
  const abs = axes.map((a) => (a.startsWith("-") || a.startsWith("+") ? (a.slice(1) as Axis) : a)) as Axis[];
  return new Set(abs).size === 3;
}

export function isValidCoordinateConfig(c: any): c is CoordinateConfig {
  if (!isValidCoordinates(c)) return false;
  const config = c as CoordinateConfig;
  if (!config.spaces) return true;
  const spaces = config.spaces;
  if (typeof spaces !== "object") return false;
  for (const key of Object.keys(spaces)) {
    const value = (spaces as Record<string, unknown>)[key];
    if (value && !isValidCoordinates(value)) return false;
  }
  return true;
}

export function getCoordinateSystem(lang: LanguagePack | undefined, space: CoordinateSpace = "world"): CoordinateSystem {
  const coords = lang?.coordinates as CoordinateConfig | undefined;
  if (!coords) {
    return DEFAULT_COORDS;
  }
  if (!isValidCoordinateConfig(coords)) {
    return DEFAULT_COORDS;
  }
  if (space !== "world") {
    const specific = coords.spaces?.[space];
    if (specific && isValidCoordinates(specific)) {
      return stripSpaces(specific);
    }
  }
  return stripSpaces(coords);
}

export type SwizzleMapping = {
  x: SignedAxis;
  y: SignedAxis;
  z: SignedAxis;
};

const axisOrder: Axis[] = ["x", "y", "z"];

function normalizeAxis(token: SignedAxis): { axis: Axis; sign: 1 | -1 } {
  if (token.startsWith("-")) return { axis: token.slice(1) as Axis, sign: -1 };
  if (token.startsWith("+")) return { axis: token.slice(1) as Axis, sign: 1 };
  return { axis: token as Axis, sign: 1 };
}

function formatSignedAxis(axis: Axis, sign: 1 | -1): SignedAxis {
  return sign === -1 ? (`-${axis}` as SignedAxis) : axis;
}

function swizzleFromMapping(expr: string, mapping: SwizzleMapping): string {
  if (mapping.x === "x" && mapping.y === "y" && mapping.z === "z") {
    return expr;
  }
  const base = `(${expr})`;
  const components = [mapping.x, mapping.y, mapping.z].map((signed) => {
    const { axis, sign } = normalizeAxis(signed);
    const accessor = `${base}.${axis}`;
    return sign === -1 ? `-(${accessor})` : accessor;
  });
  return `vec3(${components.join(", ")})`;
}

// Compute mapping from reference (ThreeJS) axes to target language axes.
// The reference is fixed to { up: 'y', right: 'x', forward: 'z' }.
// Returns how to read a vec3 in the target to match reference semantics.
export function computeSwizzleToTarget(target: CoordinateSystem): SwizzleMapping {
  return {
    x: target.right,
    y: target.up,
    z: target.forward,
  };
}

function invertSwizzleMapping(mapping: SwizzleMapping): SwizzleMapping {
  const inverse: SwizzleMapping = { x: "x", y: "y", z: "z" };
  for (const targetAxis of axisOrder) {
    const signedRef = mapping[targetAxis];
    const { axis: refAxis, sign } = normalizeAxis(signedRef);
    inverse[refAxis] = formatSignedAxis(targetAxis, sign) as SignedAxis;
  }
  return inverse;
}

// Given an expression for a vec3 in reference space, return a string that swizzles
// or reorders components to match the target coordinate system.
export function swizzleVec3(expr: string, target: CoordinateSystem): string {
  return swizzleFromMapping(expr, computeSwizzleToTarget(target));
}

const REFERENCE: CoordinateSystem = DEFAULT_COORDS;

function coordsEqual(a: CoordinateSystem, b: CoordinateSystem): boolean {
  return a.up === b.up && a.right === b.right && a.forward === b.forward;
}

// Swizzle a vector authored in the ThreeJS reference space into target space.
export function swizzleDirectionRefToTarget(expr: string, target: CoordinateSystem): string {
  if (coordsEqual(target, REFERENCE)) return expr;
  return swizzleVec3(expr, target);
}

// Convert a vector expressed in the target space back into reference space.
export function swizzleDirectionTargetToRef(expr: string, target: CoordinateSystem): string {
  if (coordsEqual(target, REFERENCE)) return expr;
  const inverse = invertSwizzleMapping(computeSwizzleToTarget(target));
  return swizzleFromMapping(expr, inverse);
}
