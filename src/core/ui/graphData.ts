import type { Edge, Node } from "@xyflow/react";
import type { NodeTemplate } from "../schema/nodes";
import { parseHandleId as _parseHandleId } from "./handles";
import {
  chooseDominantPinType,
  guessPinTypeFromLiteral,
  normalizePinType,
  widenPinType,
} from "../types/pinTypes";
import { parseEditorSize } from "./nodeFactory";

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
  const polymorphic = new Map<any, { inputs: Set<number>; outputs: Set<number> }>();
  for (const n of nodes) {
    const t = (n.data as any)?.template as NodeTemplate | undefined;
    const base = t
      ? JSON.parse(JSON.stringify(t))
      : {
          type: (n.data as any)?.type ?? "",
          name: (n.data as any)?.label ?? "",
          meta: [],
          nodes: [],
          inputs: [],
          outputs: [],
          properties: [],
        };
    const idNum = Number(n.id);
    if (Number.isFinite(idNum)) base.id = idNum;
    base.position = [Math.round(n.position.x), Math.round(n.position.y)];
    base.meta ??= [];
    base.nodes = [];
    base.inputs ??= [];
    base.outputs ??= [];
    base.properties = Array.isArray(base.properties) ? base.properties : [];
    // Remove transient meta used by polymorphic UIs
    base.meta = base.meta.filter((m: any) => !(m && typeof m === "object" && "current_pintype" in m));
    const assetMeta = base.meta.find((m: any) => typeof m === "string" && m.startsWith("asset:"));
    if (assetMeta) {
      const source = assetMeta.slice("asset:".length).trim();
      if (source) {
        let assigned = false;
        base.properties = base.properties.map((prop: any) => {
          if (prop && typeof prop === "object" && (prop.id === "source" || prop.id === "texture_source")) {
            assigned = true;
            return { ...prop, value: source };
          }
          return prop;
        });
        if (!assigned) {
          base.properties.push({ id: "source", type: "asset", label: "Texture Asset", assetKind: "texture", value: source });
        }
      }
      base.meta = base.meta.filter((m: any) => m !== assetMeta);
    }
    if (base.type === "fragment_output") {
      const shadingMeta = base.meta.find((m: any) => typeof m === "string" && m.startsWith("shading_"));
      if (shadingMeta) {
        const slug = shadingMeta.slice("shading_".length).trim();
        const map: Record<string, string> = { pbr: "pbr", unlit: "unlit", toon: "toon" };
        const value = map[slug] ?? undefined;
        if (value) {
          let assigned = false;
          base.properties = base.properties.map((prop: any) => {
            if (prop && typeof prop === "object" && prop.id === "shading_model") {
              assigned = true;
              return { ...prop, value };
            }
            return prop;
          });
          if (!assigned) {
            base.properties.push({ id: "shading_model", type: "enum", value });
          }
        }
        base.meta = base.meta.filter((m: any) => m !== shadingMeta);
      }
    }
    const polyInfo = { inputs: new Set<number>(), outputs: new Set<number>() };
    if (t?.inputs) {
      base.inputs.forEach((p: any, idx: number) => {
        const tmplPin = t.inputs?.[idx];
        if (tmplPin && Array.isArray(tmplPin.type)) {
          const id = typeof p.id === "number" ? p.id : idx;
          polyInfo.inputs.add(id);
        }
      });
    }
    if (t?.outputs) {
      base.outputs.forEach((p: any, idx: number) => {
        const tmplPin = t.outputs?.[idx];
        if (tmplPin && Array.isArray(tmplPin.type)) {
          const id = typeof p.id === "number" ? p.id : idx;
          polyInfo.outputs.add(id);
        }
      });
    }
    polymorphic.set(base, polyInfo);

    const readDimension = (key: "width" | "height"): number | undefined => {
      const styleVal = (n as any)?.style?.[key];
      if (typeof styleVal === "number" && Number.isFinite(styleVal)) return Math.round(styleVal);
      if (typeof styleVal === "string") {
        const parsed = Number.parseFloat(styleVal);
        if (Number.isFinite(parsed)) return Math.round(parsed);
      }
      const direct = (n as any)?.[key];
      if (typeof direct === "number" && Number.isFinite(direct)) return Math.round(direct);
      const measured = (n as any)?.measured?.[key];
      if (typeof measured === "number" && Number.isFinite(measured)) return Math.round(measured);
      return undefined;
    };
    if (base.meta.includes("editor_node")) {
      const currentSize = parseEditorSize(base.meta as string[]);
      const width = readDimension("width") ?? currentSize.width;
      const height = readDimension("height") ?? currentSize.height;
      if (Number.isFinite(width) && Number.isFinite(height)) {
        const nextEntry = `editor_size:${Math.max(0, Math.round(width!))}x${Math.max(0, Math.round(height!))}`;
        const idx = base.meta.findIndex((m: any) => typeof m === "string" && m.startsWith("editor_size:"));
        if (idx >= 0) {
          base.meta[idx] = nextEntry;
        } else {
          base.meta.push(nextEntry);
        }
      }
    }
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
  // Encode connections into both input and output
  for (const e of edges) {
    const src = map[e.source];
    const dst = map[e.target];
    if (!src || !dst) continue;
    const tgtId = (() => {
      const h = _parseHandleId(e.targetHandle as any);
      if (h) return h;
      return typeof dst.inputs?.[0]?.id === "number" ? dst.inputs[0].id : 0;
    })();
    const srcOutId = (() => {
      const h = _parseHandleId(e.sourceHandle as any);
      if (h) return h;
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
    const candidateTypes: string[] = [];
    const fallbackTypes: string[] = [];
    const poly = polymorphic.get(node);
    for (const pin of node.inputs) {
      const declared = normalizePinType(pin.type);
      if (declared) fallbackTypes.push(declared);
      let resolved: string | undefined;
      const ref = parseRef(pin.value);
      if (ref) {
        const src = map[ref.nodeId];
        if (src) {
          const st = getOutputType(src, ref.pinId);
          if (st) resolved = st;
        }
      }
      if (!resolved) resolved = guessPinTypeFromLiteral(pin.value);
      if (resolved && Array.isArray(pin.type) && !pin.type.includes(resolved)) {
        resolved = undefined;
      }
      if (Array.isArray(pin.type)) {
        if (resolved) {
          pin.type = resolved;
        } else if (declared) {
          pin.type = declared;
        } else if (pin.type.length) {
          pin.type = pin.type[0];
        }
      }
      if (!resolved) resolved = typeof pin.type === "string" ? pin.type : declared;
      if (resolved) candidateTypes.push(resolved);
    }

    const dominantType = chooseDominantPinType([...candidateTypes, ...fallbackTypes]);

    for (const pin of node.inputs) {
      const id = typeof pin.id === "number" ? pin.id : undefined;
      const allowPoly = !!(id !== undefined && poly?.inputs.has(id));
      const declared = normalizePinType(pin.type);
      const targetType = widenPinType(dominantType, declared) ?? dominantType ?? declared;
      if (!targetType) continue;
      if (Array.isArray(pin.type)) {
        pin.type = pin.type.includes(targetType) ? targetType : pin.type[0];
      } else if (allowPoly) {
        pin.type = targetType;
      }
    }

    for (const pin of node.outputs) {
      const id = typeof pin.id === "number" ? pin.id : undefined;
      const allowPoly = !!(id !== undefined && poly?.outputs.has(id));
      const declared = normalizePinType(pin.type);
      const targetType = dominantType ?? declared;
      if (!targetType) continue;
      if (Array.isArray(pin.type)) {
        pin.type = pin.type.includes(targetType) ? targetType : pin.type[0];
      } else if (allowPoly) {
        pin.type = targetType;
      }
    }
  }

  return root;
}
