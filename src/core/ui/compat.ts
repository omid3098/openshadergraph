import type { Node } from "@xyflow/react";
import { parseHandleId } from "./handles";

export type NormalizedPinType =
  | "float" | "float2" | "float3" | "float4"
  | "int" | "bool"
  | "mat3" | "mat4"
  | "sampler2d" | "sampler3d" | "samplercube" | "sampler"
  | "unknown";

export function normalizePinType(raw: unknown): NormalizedPinType {
  const s = Array.isArray(raw) ? String(raw[0] ?? "") : String(raw ?? "");
  const t = s.trim().toLowerCase();
  if (!t) return "unknown";
  if (t === "float") return "float";
  if (t === "float2" || t === "vec2" || t === "uv") return "float2";
  if (t === "float3" || t === "vec3" || t === "normal" || t === "position") return "float3";
  if (t === "float4" || t === "vec4" || t === "color") return "float4";
  if (t === "int") return "int";
  if (t === "bool") return "bool";
  if (t === "mat3" || t === "matrix3") return "mat3";
  if (t === "mat4" || t === "matrix4") return "mat4";
  if (t === "sampler2d" || t === "texture2d") return "sampler2d";
  if (t === "sampler3d" || t === "texture3d") return "sampler3d";
  if (t === "samplercube" || t === "texturecube") return "samplercube";
  if (t.includes("sampler")) return "sampler";
  return "unknown";
}

function normalizePinTypeOptions(raw: unknown): NormalizedPinType[] {
  if (Array.isArray(raw)) {
    const opts = raw
      .map((r) => normalizePinType(r))
      .filter((t): t is NormalizedPinType => !!t && t !== "unknown");
    // Deduplicate while preserving order
    const seen = new Set<string>();
    const dedup: NormalizedPinType[] = [];
    for (const o of opts) {
      if (!seen.has(o)) { seen.add(o); dedup.push(o); }
    }
    return dedup;
  }
  const single = normalizePinType(raw);
  return single === "unknown" ? [] : [single];
}

export function arePinTypesCompatible(source: NormalizedPinType, target: NormalizedPinType): boolean {
  if (source === "unknown" || target === "unknown") return false;
  // Exact matches
  if (source === target) return true;
  // Scalar broadcast to vectors
  if (source === "float" && (target === "float2" || target === "float3" || target === "float4")) return true;
  // Vector downcast (drop components): allow float4->float3/2 and float3->float2
  if (source === "float4" && (target === "float3" || target === "float2")) return true;
  if (source === "float3" && target === "float2") return true;
  // Texture/sampler types must match their precise kind
  const isSamplerSrc = source.startsWith("sampler");
  const isSamplerDst = target.startsWith("sampler");
  if (isSamplerSrc || isSamplerDst) return source === target;
  // Booleans and ints: strict only
  if (source === "bool" || target === "bool" || source === "int" || target === "int") return false;
  // Matrices: strict only
  if ((source === "mat3" || source === "mat4") || (target === "mat3" || target === "mat4")) return false;
  // Disallow vector->scalar implicit
  if ((source === "float2" || source === "float3" || source === "float4") && target === "float") return false;
  // Disallow cross-dimension vector connections for now (adapters later)
  return false;
}

export function getPinTypeFor(nodes: Node[], nodeId: string, handleId: string | null | undefined): NormalizedPinType {
  if (!handleId) return "unknown";
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return "unknown";
  const tpl: any = (node.data as any)?.template;
  const m = String(handleId).match(/^(in|input|out|output)-(\d+)$/);
  if (!m) return "unknown";
  const dir = m[1];
  const pid = parseHandleId(handleId);
  const pins: any[] = Array.isArray(dir.startsWith("in") ? tpl?.inputs : tpl?.outputs) ? (dir.startsWith("in") ? tpl.inputs : tpl.outputs) : [];
  let found: any | undefined;
  for (let i = 0; i < pins.length; i++) {
    const p = pins[i];
    if (!p || typeof p !== "object") continue;
    const idVal = typeof p.id === "number" ? p.id : i;
    if (idVal === pid) {
      found = p;
      break;
    }
  }
  return normalizePinType(found?.type);
}

export function getPinTypeOptionsFor(nodes: Node[], nodeId: string, handleId: string | null | undefined): NormalizedPinType[] {
  if (!handleId) return [];
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return [];
  const tpl: any = (node.data as any)?.template;
  const m = String(handleId).match(/^(in|input|out|output)-(\d+)$/);
  if (!m) return [];
  const dir = m[1];
  const pid = parseHandleId(handleId);
  const pins: any[] = Array.isArray(dir.startsWith("in") ? tpl?.inputs : tpl?.outputs) ? (dir.startsWith("in") ? tpl.inputs : tpl.outputs) : [];
  for (let i = 0; i < pins.length; i++) {
    const p = pins[i];
    if (!p || typeof p !== "object") continue;
    const idVal = typeof p.id === "number" ? p.id : i;
    if (idVal === pid) {
      return normalizePinTypeOptions((p as any).type);
    }
  }
  return [];
}

export function isConnectionCompatible(nodes: Node[], conn: { source?: string | null; target?: string | null; sourceHandle?: string | null; targetHandle?: string | null }): boolean {
  const sourceOpts = getPinTypeOptionsFor(nodes, String(conn.source ?? ""), conn.sourceHandle);
  const targetOpts = getPinTypeOptionsFor(nodes, String(conn.target ?? ""), conn.targetHandle);
  // If we have option lists, allow any compatible pairing
  if (sourceOpts.length || targetOpts.length) {
    for (const s of sourceOpts.length ? sourceOpts : [getPinTypeFor(nodes, String(conn.source ?? ""), conn.sourceHandle)]) {
      for (const t of targetOpts.length ? targetOpts : [getPinTypeFor(nodes, String(conn.target ?? ""), conn.targetHandle)]) {
        if (arePinTypesCompatible(s, t)) return true;
      }
    }
    return false;
  }
  // Fallback to single-type check
  const sourceType = getPinTypeFor(nodes, String(conn.source ?? ""), conn.sourceHandle);
  const targetType = getPinTypeFor(nodes, String(conn.target ?? ""), conn.targetHandle);
  return arePinTypesCompatible(sourceType, targetType);
}

// Helpers for edge coloring (optional callers)
export function getSourceType(nodes: Node[], e: { source?: string | null; sourceHandle?: string | null }) {
  return getPinTypeFor(nodes, String(e.source ?? ""), e.sourceHandle ?? undefined);
}
export function getTargetType(nodes: Node[], e: { target?: string | null; targetHandle?: string | null }) {
  return getPinTypeFor(nodes, String(e.target ?? ""), e.targetHandle ?? undefined);
}


