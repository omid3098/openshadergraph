import type { Edge, Node } from "@xyflow/react";
import type { NodeTemplate } from "../schema/nodes";

// Build the canonical graph JSON from ReactFlow nodes/edges.
// Mirrors the logic in App.tsx but extracted for testability and reuse.
export function buildGraphData(nodes: Node[], edges: Edge[], graphName: string) {
  const root: any = {
    type: "",
    name: graphName,
    meta: [],
    nodes: [] as any[],
    inputs: [],
    outputs: [],
  };

  const map: Record<string, any> = {};
  const parentMap: Record<string, string | undefined> = {};
  for (const n of nodes) {
    const t = (n.data as any)?.template as NodeTemplate | undefined;
    const base = t
      ? JSON.parse(JSON.stringify(t))
      : { type: (n.data as any)?.type ?? "", name: (n.data as any)?.label ?? "", meta: [], nodes: [], inputs: [], outputs: [] };
    const idNum = Number(n.id);
    if (Number.isFinite(idNum)) base.id = idNum;
    base.position = [Math.round(n.position.x), Math.round(n.position.y)];
    base.meta ??= [];
    base.nodes = [];
    base.inputs ??= [];
    base.outputs ??= [];
    // Remove transient meta used by polymorphic UIs
    base.meta = base.meta.filter((m: any) => !(m && typeof m === "object" && "current_pintype" in m));
    map[n.id] = base;
    parentMap[n.id] = (n as any).parentId;
  }

  for (const id of Object.keys(map)) {
    const parentId = parentMap[id];
    if (parentId && map[parentId]) {
      map[parentId].nodes.push(map[id]);
    } else {
      root.nodes.push(map[id]);
    }
  }

  // Edge helpers
  const parseRef = (v: any): { nodeId: string; pinId: number } | null => {
    if (typeof v !== "string") return null;
    const m = v.match(/^\.\.\/(\d+)\/(\d+)$/);
    if (!m) return null;
    return { nodeId: m[1], pinId: Number(m[2]) };
  };
  const inferScalarFromLiteral = (val: any): string | undefined => {
    if (Array.isArray(val) && val.every((n) => typeof n === "number")) {
      const len = val.length;
      if (len === 1) return "float";
      if (len === 2) return "float2";
      if (len === 3) return "float3";
      if (len === 4) return "float4";
    }
    return undefined;
  };

  // Encode connections into both input and output
  for (const e of edges) {
    const src = map[e.source];
    const dst = map[e.target];
    if (!src || !dst) continue;
    const tgtId = (() => {
      if (e.targetHandle) {
        const m = String(e.targetHandle).match(/(in|input)-(?<id>\d+)/);
        if (m?.groups?.id) return Number(m.groups.id);
      }
      return typeof dst.inputs?.[0]?.id === "number" ? dst.inputs[0].id : 0;
    })();
    const srcOutId = (() => {
      if (e.sourceHandle) {
        const m = String(e.sourceHandle).match(/(out|output)-(?<id>\d+)/);
        if (m?.groups?.id) return Number(m.groups.id);
      }
      return typeof src.outputs?.[0]?.id === "number" ? src.outputs[0].id : 0;
    })();
    // input side
    const dstPinIndex = dst.inputs.findIndex((p: any) => p.id === tgtId);
    const inIdx = dstPinIndex >= 0 ? dstPinIndex : 0;
    if (dst.inputs?.[inIdx]) {
      dst.inputs[inIdx].value = `../${Number(e.source)}/${srcOutId}`;
    }
    // output side
    const srcOutIndex = src.outputs.findIndex((p: any) => p.id === srcOutId);
    const outIdx = srcOutIndex >= 0 ? srcOutIndex : 0;
    if (src.outputs?.[outIdx]) {
      src.outputs[outIdx].value = `../${Number(e.target)}/${tgtId}`;
    }
  }

  // Resolve polymorphic pin types
  const getOutputType = (node: any, outId: number): string | undefined => {
    const out = (node.outputs ?? []).find((p: any) => (typeof p.id === "number" ? p.id === outId : false)) ?? node.outputs?.[0];
    if (!out) return undefined;
    const t = out.type;
    if (typeof t === "string") return t;
    if (Array.isArray(t) && t.length) return t[0];
    return undefined;
  };
  for (const key of Object.keys(map)) {
    const node = map[key];
    for (const pin of node.inputs) {
      const t = pin.type;
      if (Array.isArray(t)) {
        let resolved: string | undefined;
        const ref = parseRef(pin.value);
        if (ref) {
          const src = map[ref.nodeId];
          if (src) {
            const st = getOutputType(src, ref.pinId);
            if (st && t.includes(st)) resolved = st;
          }
        }
        if (!resolved) resolved = inferScalarFromLiteral(pin.value);
        if (!resolved && t.length) resolved = t[0];
        if (resolved) pin.type = resolved;
      }
    }
    const firstResolvedInput = node.inputs.find((p: any) => typeof p.type === "string")?.type;
    for (const pin of node.outputs) {
      const t = pin.type;
      if (Array.isArray(t)) {
        pin.type = (firstResolvedInput && t.includes(firstResolvedInput)) ? firstResolvedInput : t[0];
      }
    }
  }

  return root;
}

