import type { Edge, Node } from "@xyflow/react";
import type { NodePaletteItem, NodeTemplate } from "../schema/types";
import { buildRFNodeFromTemplate } from "./nodeFactory";

type XYPosition = { x: number; y: number };

type CreateRerouteInsertionOptions = {
  edge: Edge;
  edges: Edge[];
  nodes: Node[];
  template: NodeTemplate;
  item: NodePaletteItem;
  position: XYPosition;
  nextId: string;
  parentId?: string;
  nodeDefaults?: Partial<Node>;
};

const EDGE_STYLE_KEYS: Array<keyof Edge> = [
  "type",
  "animated",
  "style",
  "label",
  "labelStyle",
  "labelBgPadding",
  "labelBgBorderRadius",
  "labelBgStyle",
  "markerStart",
  "markerEnd",
  "interactionWidth",
  "className",
];

function cloneEdgeVisualProps(edge: Edge): Partial<Edge> {
  const result: Partial<Edge> = {};
  for (const key of EDGE_STYLE_KEYS) {
    if (edge[key] !== undefined) {
      result[key] = edge[key];
    }
  }
  if (edge.data) {
    const cloned = { ...(edge.data as Record<string, unknown>) };
    delete (cloned as any).sourceType;
    delete (cloned as any).targetType;
    if (Object.keys(cloned).length > 0) {
      result.data = cloned as any;
    }
  }
  return result;
}

export function createRerouteInsertion(opts: CreateRerouteInsertionOptions): { node: Node; edges: Edge[] } {
  const { edge, edges, nodes, template, item, position, nextId, parentId, nodeDefaults } = opts;

  if (!edge?.source || !edge?.target) {
    throw new Error("Cannot insert reroute: edge is missing endpoints");
  }

  const resolvedParentId = parentId ?? inferSharedParentId(edge, nodes);

  const rerouteNode = buildRFNodeFromTemplate({
    id: nextId,
    item,
    template,
    position,
    ...(resolvedParentId ? { parentId: resolvedParentId } : {}),
    ...(nodeDefaults ? { nodeDefaults } : {}),
  });

  const filteredEdges = edges.filter((e) => e.id !== edge.id);
  const sharedProps = cloneEdgeVisualProps(edge);

  const sourceHandle = edge.sourceHandle ?? undefined;
  const targetHandle = edge.targetHandle ?? undefined;

  const linkId = (src: string | null | undefined, tgt: string | null | undefined, sh?: string | null, th?: string | null) => {
    const srcPart = src ?? "";
    const tgtPart = tgt ?? "";
    const shPart = sh ?? "";
    const thPart = th ?? "";
    return `e${srcPart}-${tgtPart}-${shPart}-${thPart}`;
  };

  const toReroute: Edge = {
    id: linkId(edge.source, nextId, sourceHandle, "in-0"),
    source: edge.source,
    target: nextId,
    sourceHandle,
    targetHandle: "in-0",
    ...sharedProps,
  } as Edge;

  const fromReroute: Edge = {
    id: linkId(nextId, edge.target, "out-0", targetHandle),
    source: nextId,
    target: edge.target,
    sourceHandle: "out-0",
    targetHandle,
    ...sharedProps,
  } as Edge;

  // Preserve ordering close to original: insert the new edges at the end so ReactFlow can reconcile deterministically
  const nextEdges = [...filteredEdges, toReroute, fromReroute];

  return { node: rerouteNode as Node, edges: nextEdges };
}

export function inferSharedParentId(edge: Edge, nodes: Node[]): string | undefined {
  const source = nodes.find((n) => n.id === edge.source);
  const target = nodes.find((n) => n.id === edge.target);
  if (!source && !target) return undefined;
  const srcParent = source?.parentId;
  const tgtParent = target?.parentId;
  if (srcParent && tgtParent && srcParent === tgtParent) return srcParent;
  return tgtParent ?? srcParent ?? undefined;
}
