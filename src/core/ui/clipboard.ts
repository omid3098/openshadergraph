import { z } from "zod";
import type { Graph, GraphNode, InputPin, OutputPin } from "@/core/graph/types";
import { validateNodeTemplate } from "@/core/schema/validators";

export type ClipboardBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type ClipboardParentEntry = {
  nodeId: number;
  parentId: number | null;
};

export type ClipboardPayload = {
  version: 1;
  nodes: GraphNode[];
  parents: ClipboardParentEntry[];
  bounds: ClipboardBounds;
};

const REF_RE = /^\.\.\/(\d+)\/(\d+)$/;

const ZClipboardBounds = z.object({
  minX: z.number(),
  minY: z.number(),
  maxX: z.number(),
  maxY: z.number(),
});

const ZClipboardParents = z.array(
  z.object({
    nodeId: z.number().int(),
    parentId: z.number().int().nullable(),
  })
);

const ZClipboardPayload = z.object({
  version: z.literal(1),
  nodes: z.array(z.any()).min(1),
  parents: ZClipboardParents.default([]),
  bounds: ZClipboardBounds,
});

type ParentLookup = (id: number) => number | null;

function cloneNode(node: GraphNode): GraphNode {
  return JSON.parse(JSON.stringify(node)) as GraphNode;
}

function ensurePinIds(pins: Array<InputPin | OutputPin> | undefined) {
  if (!Array.isArray(pins)) return;
  for (let i = 0; i < pins.length; i += 1) {
    const pin = pins[i];
    if (!pin || typeof pin !== "object") continue;
    if (typeof pin.id !== "number") {
      (pin as any).id = i;
    }
  }
}

function sanitizeConnections(node: GraphNode, selectedIds: Set<number>) {
  const scrub = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const match = value.match(REF_RE);
    if (!match) return undefined;
    const sourceId = Number(match[1]);
    if (!selectedIds.has(sourceId)) return undefined;
    const pinId = Number(match[2]);
    return `../${sourceId}/${pinId}`;
  };

  if (Array.isArray(node.inputs)) {
    for (let i = 0; i < node.inputs.length; i += 1) {
      const pin = node.inputs[i];
      if (!pin || typeof pin !== "object") continue;
      const value = scrub((pin as any).value);
      if (value === undefined) {
        delete (pin as any).value;
      } else {
        (pin as any).value = value;
      }
    }
  }
  if (Array.isArray(node.outputs)) {
    for (let i = 0; i < node.outputs.length; i += 1) {
      const pin = node.outputs[i];
      if (!pin || typeof pin !== "object") continue;
      const value = scrub((pin as any).value);
      if (value === undefined) {
        delete (pin as any).value;
      } else {
        (pin as any).value = value;
      }
    }
  }
}

function indexGraph(root: Graph, out: Map<number, GraphNode>) {
  const walk = (node: GraphNode) => {
    if (typeof node.id === "number") {
      out.set(node.id, node);
    }
    if (Array.isArray(node.nodes)) {
      for (const child of node.nodes) walk(child);
    }
  };
  if (Array.isArray(root.nodes)) {
    for (const node of root.nodes) walk(node);
  }
}

export function createClipboardPayload(params: {
  graph: Graph;
  selectedIds: Set<number>;
  parentLookup: ParentLookup;
  bounds: ClipboardBounds;
}): ClipboardPayload | null {
  const { graph, selectedIds, parentLookup, bounds } = params;
  if (!selectedIds.size) return null;

  const index = new Map<number, GraphNode>();
  indexGraph(graph, index);

  const nodes: GraphNode[] = [];
  const parents: ClipboardParentEntry[] = [];

  const sortedIds = Array.from(selectedIds).sort((a, b) => a - b);
  for (const id of sortedIds) {
    const original = index.get(id);
    if (!original) continue;
    const clone = cloneNode(original);
    clone.parent = undefined;
    clone.nodes = [] as any;
    ensurePinIds(clone.inputs as any);
    ensurePinIds(clone.outputs as any);
    sanitizeConnections(clone, selectedIds);
    validateNodeTemplate(clone);
    nodes.push(clone);
    parents.push({ nodeId: id, parentId: parentLookup(id) });
  }

  if (!nodes.length) return null;

  return {
    version: 1,
    nodes,
    parents,
    bounds,
  };
}

export function parseClipboardPayload(text: string): ClipboardPayload {
  const parsed = ZClipboardPayload.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error("Invalid clipboard payload");
  }
  const payload = parsed.data;
  const nodes: GraphNode[] = payload.nodes.map((node: any) => {
    validateNodeTemplate(node);
    return node as GraphNode;
  });
  return {
    version: 1,
    nodes,
    parents: payload.parents,
    bounds: payload.bounds,
  };
}

export function remapClipboardNodes(params: {
  payload: ClipboardPayload;
  allocateId: () => number;
  offset: { x: number; y: number };
}): {
  nodes: GraphNode[];
  idMap: Map<number, number>;
  parentAssignments: Map<number, number | null>;
} {
  const { payload, allocateId, offset } = params;
  const selectedIds = new Set(payload.nodes.map((node) => node.id));
  const parentById = new Map<number, number | null>();
  for (const entry of payload.parents) {
    parentById.set(entry.nodeId, entry.parentId ?? null);
  }

  const idMap = new Map<number, number>();
  const clones = payload.nodes.map((node) => {
    const clone = cloneNode(node);
    (clone as any).parent = undefined;
    clone.nodes = [] as any;
    return clone;
  });

  for (const clone of clones) {
    const oldId = typeof clone.id === "number" ? clone.id : 0;
    const newId = allocateId();
    idMap.set(oldId, newId);
    (clone as any).id = newId;
    ensurePinIds(clone.inputs as any);
    ensurePinIds(clone.outputs as any);
  }

  const parentAssignments = new Map<number, number | null>();

  clones.forEach((clone, index) => {
    const original = payload.nodes[index];
    const oldId = original.id;
    const inputs = Array.isArray(clone.inputs) ? clone.inputs : [];
    const outputs = Array.isArray(clone.outputs) ? clone.outputs : [];

    for (const pin of inputs) {
      const value = (pin as any).value;
      if (typeof value !== "string") {
        delete (pin as any).value;
        continue;
      }
      const match = value.match(REF_RE);
      if (!match) {
        delete (pin as any).value;
        continue;
      }
      const sourceOldId = Number(match[1]);
      const pinId = Number(match[2]);
      const mapped = idMap.get(sourceOldId);
      if (!mapped) {
        delete (pin as any).value;
        continue;
      }
      (pin as any).value = `../${mapped}/${pinId}`;
    }

    for (const pin of outputs) {
      const value = (pin as any).value;
      if (typeof value !== "string") {
        delete (pin as any).value;
        continue;
      }
      const match = value.match(REF_RE);
      if (!match) {
        delete (pin as any).value;
        continue;
      }
      const targetOldId = Number(match[1]);
      const pinId = Number(match[2]);
      const mapped = idMap.get(targetOldId);
      if (!mapped) {
        delete (pin as any).value;
        continue;
      }
      (pin as any).value = `../${mapped}/${pinId}`;
    }

    const parentOldId = parentById.get(oldId) ?? null;
    const parentNewId = parentOldId !== null && idMap.has(parentOldId) ? idMap.get(parentOldId)! : parentOldId;
    parentAssignments.set(clone.id as number, parentNewId);

    const shouldOffset = parentOldId === null || !selectedIds.has(parentOldId);
    if (shouldOffset && Array.isArray(clone.position) && clone.position.length >= 2) {
      const [x, y] = clone.position as [number, number];
      clone.position = [Math.round(x + offset.x), Math.round(y + offset.y)];
    }
  });

  return { nodes: clones, idMap, parentAssignments };
}
