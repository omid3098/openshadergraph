export type PinTypeKind = "scalar" | "vector" | "matrix" | "sampler" | "unknown";

export type PinTypeDescriptor = {
  name: string;
  kind: PinTypeKind;
  components: number;
  rank: number;
};

export function getCoreTypeInfo(type: string | undefined): PinTypeDescriptor | undefined {
  if (!type) return undefined;
  const name = String(type);
  let kind: PinTypeKind = "unknown";
  let components = 1;
  if (name === "float") {
    kind = "scalar";
    components = 1;
  } else if (/^float[2-4]$/.test(name)) {
    kind = "vector";
    components = Number(name.replace("float", ""));
  } else if (/^matrix[2-4]$/.test(name)) {
    kind = "matrix";
    components = Number(name.replace("matrix", ""));
  } else if (/^sampler/.test(name)) {
    kind = "sampler";
    components = 1;
  }
  const base = kind === "scalar" ? 0x10 : kind === "vector" ? 0x20 : kind === "matrix" ? 0x30 : 0x00;
  const rank = base + components;
  return { name, kind, components, rank };
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
    const desc = getCoreTypeInfo(t);
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

// Deprecated: do not use. Kept during migration window only.
export function formatTypeForGLSL(_type: string | undefined): string | undefined {
  return undefined;
}

export function formatTypeForLanguage(type: string | undefined, _languageName?: string, types?: Record<string, { code: string }>): string | undefined {
  if (!type) return undefined;
  if (types && types[type]?.code) return types[type].code;
  // Fallback to returning the raw type so language packs must provide mapping
  return type;
}

export function widenPinType(current: string | undefined, next: string | undefined): string | undefined {
  if (!current) return next;
  if (!next) return current;
  const chosen = chooseDominantPinType([current, next]);
  return chosen ?? current;
}
