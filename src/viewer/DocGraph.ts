import { z } from "zod";

// Compact schema for documentation graphs embedded via iframe
// Example:
// {
//   "v": 1,
//   "nodes": [
//     { "id": 1, "t": "float", "x": 60, "y": 100, "props": { "value": 0.5 } },
//     { "id": 2, "t": "sin",   "x": 280, "y": 100 }
//   ],
//   "edges": [ { "from": [1,0], "to": [2,0] } ]
// }

export const DocGraphNodeSchema = z.object({
  id: z.number().int(),
  t: z.string(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  props: z.record(z.any()).optional(),
});

export const DocGraphEdgeSchema = z.object({
  from: z.tuple([z.number().int(), z.number().int()]), // [nodeId, outputPinIndex]
  to: z.tuple([z.number().int(), z.number().int()]),   // [nodeId, inputPinIndex]
});

export const DocGraphSchema = z.object({
  v: z.number().int().default(1),
  nodes: z.array(DocGraphNodeSchema).default([]),
  edges: z.array(DocGraphEdgeSchema).default([]),
});

export type DocGraph = z.infer<typeof DocGraphSchema>;
export type DocGraphNode = z.infer<typeof DocGraphNodeSchema>;
export type DocGraphEdge = z.infer<typeof DocGraphEdgeSchema>;

export function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLen);
  if (typeof atob === "function") {
    return atob(padded);
  }
  // Node fallback (shouldn't be used in browser viewer)
  return Buffer.from(padded, "base64").toString("utf8");
}

export function parseDocGraphFromParams(params: URLSearchParams): DocGraph | null {
  // Prefer graph64, fallback to graph, then demo
  const graph64 = params.get("graph64");
  const rawGraph = params.get("graph");
  const demo = params.get("demo");

  try {
    if (graph64) {
      const json = decodeBase64Url(graph64);
      return DocGraphSchema.parse(JSON.parse(json));
    }
    if (rawGraph) {
      return DocGraphSchema.parse(JSON.parse(rawGraph));
    }
    if (demo === "float-sin") {
      return DocGraphSchema.parse({
        v: 1,
        nodes: [
          { id: 1, t: "float", x: 60, y: 100, props: { value: 0.5 } },
          { id: 2, t: "sin", x: 280, y: 100 },
        ],
        edges: [ { from: [1, 0], to: [2, 0] } ],
      });
    }
  } catch (_err) {
    // fallthrough to null
  }
  return null;
}


