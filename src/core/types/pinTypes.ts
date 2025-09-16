export type PinTypeKind = "scalar" | "vector" | "matrix" | "sampler" | "unknown";

export type PinTypeDescriptor = {
  name: string;
  kind: PinTypeKind;
  components: number;
  glslType: string;
  rank: number;
};

const PIN_TYPES: Record<string, PinTypeDescriptor> = {
  float: { name: "float", kind: "scalar", components: 1, glslType: "float", rank: 0x10 + 1 },
  float2: { name: "float2", kind: "vector", components: 2, glslType: "vec2", rank: 0x20 + 2 },
  float3: { name: "float3", kind: "vector", components: 3, glslType: "vec3", rank: 0x20 + 3 },
  float4: { name: "float4", kind: "vector", components: 4, glslType: "vec4", rank: 0x20 + 4 },
  matrix2: { name: "matrix2", kind: "matrix", components: 2, glslType: "mat2", rank: 0x30 + 2 },
  matrix3: { name: "matrix3", kind: "matrix", components: 3, glslType: "mat3", rank: 0x30 + 3 },
  matrix4: { name: "matrix4", kind: "matrix", components: 4, glslType: "mat4", rank: 0x30 + 4 },
  sampler2D: { name: "sampler2D", kind: "sampler", components: 1, glslType: "sampler2D", rank: 0x05 },
};

export function getPinTypeDescriptor(type: string | undefined): PinTypeDescriptor | undefined {
  if (!type) return undefined;
  return PIN_TYPES[type];
}

export function normalizePinType(type: unknown): string | undefined {
  if (typeof type === "string") return type;
  if (Array.isArray(type) && type.length > 0) {
    const first = type.find((t) => typeof t === "string");
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
}

export function chooseDominantPinType(types: Array<string | undefined>): string | undefined {
  let best: PinTypeDescriptor | undefined;
  for (const t of types) {
    const desc = getPinTypeDescriptor(t);
    if (!desc) continue;
    if (!best || desc.rank > best.rank) {
      best = desc;
    }
  }
  return best?.name;
}

export function guessPinTypeFromLiteral(value: unknown): string | undefined {
  if (typeof value === "number") return "float";
  if (Array.isArray(value) && value.every((v) => typeof v === "number")) {
    const len = value.length;
    if (len === 1) return "float";
    if (len === 2) return "float2";
    if (len === 3) return "float3";
    if (len === 4) return "float4";
  }
  return undefined;
}

export function formatTypeForGLSL(type: string | undefined): string | undefined {
  if (!type) return undefined;
  const desc = getPinTypeDescriptor(type);
  return desc?.glslType;
}

export function widenPinType(current: string | undefined, next: string | undefined): string | undefined {
  if (!current) return next;
  if (!next) return current;
  const chosen = chooseDominantPinType([current, next]);
  return chosen ?? current;
}
