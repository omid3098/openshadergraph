// Utilities to group and ungroup nodes (UI-agnostic)
// Minimal Node/Edge shapes compatible with @xyflow/react

export type RFPosition = { x: number; y: number };

export type RFNode = {
  id: string;
  position: RFPosition;
  parentId?: string;
  data?: any;
  type?: string;
  style?: any;
  selectable?: boolean;
  deletable?: boolean;
};

export type RFEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

import { parseHandleId } from "../ui/handles";

export type GroupResult = { nodes: RFNode[]; edges: RFEdge[]; groupId: string; groupInputId: string; groupOutputId: string };

export function groupSelected(
  nodes: RFNode[],
  edges: RFEdge[],
  selectedIds: Set<string>,
  idGen: () => string,
): GroupResult {
  const selected = nodes.filter((n) => selectedIds.has(n.id));
  if (!selected.length) return { nodes, edges, groupId: "", groupInputId: "", groupOutputId: "" };

  // Compute bounds
  const minX = Math.min(...selected.map((n) => n.position.x));
  const minY = Math.min(...selected.map((n) => n.position.y));
  const maxX = Math.max(...selected.map((n) => n.position.x));
  const maxY = Math.max(...selected.map((n) => n.position.y));
  const padding = 48;
  const groupPos = { x: Math.round(minX - padding / 2), y: Math.round(minY - padding / 2) };
  const groupSize = { width: Math.max(160, Math.round(maxX - minX + padding)), height: Math.max(120, Math.round(maxY - minY + padding)) };

  // Derive a common parent for selected nodes (if consistent)
  const parentIds = new Set(selected.map((n) => (n as any).parentId ?? undefined));
  const commonParentId = parentIds.size === 1 ? (selected[0] as any).parentId : undefined;

  const groupId = idGen();
  const groupInputId = idGen();
  const groupOutputId = idGen();

  // Build group node + IO nodes
  const groupNode: RFNode = {
    id: groupId,
    type: "graphNode",
    position: groupPos,
    parentId: commonParentId,
    data: {
      label: "Group",
      type: "group",
      template: { id: Number(groupId), type: "group", name: "Group", meta: [], position: [groupPos.x, groupPos.y], nodes: [], inputs: [], outputs: [] },
    },
    style: { width: groupSize.width, height: groupSize.height },
    selectable: true,
  } as any;

  const groupInputNode: RFNode = {
    id: groupInputId,
    type: "graphNode",
    position: { x: 16, y: 16 },
    parentId: groupId,
    data: {
      label: "Group Input",
      type: "group_input",
      template: { id: Number(groupInputId), type: "group_input", name: "Group Input", meta: [], position: [16, 16], nodes: [], inputs: [], outputs: [] },
    },
    selectable: false,
    deletable: false,
  } as any;

  const groupOutputNode: RFNode = {
    id: groupOutputId,
    type: "graphNode",
    position: { x: Math.max(32, groupSize.width - 150), y: 16 },
    parentId: groupId,
    data: {
      label: "Group Output",
      type: "group_output",
      template: { id: Number(groupOutputId), type: "group_output", name: "Group Output", meta: [], position: [Math.max(32, groupSize.width - 150), 16], nodes: [], inputs: [], outputs: [] },
    },
    selectable: false,
    deletable: false,
  } as any;

  // Lookup helpers
  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
  const getTpl = (n?: RFNode) => (n?.data as any)?.template ?? {};
  const outPinMap = new Map<string, { pinId: number; name: string; type: any }>();
  const inPinMap = new Map<string, { pinId: number; name: string; type: any }>();
  let nextOutId = 0;
  let nextInId = 0;

  let edgeSeq = 0;
  const makeEdgeId = (src: string, sh: string | undefined, tgt: string, th: string | undefined) => `${src}${sh ? `:${sh}` : ""}->${tgt}${th ? `:${th}` : ""}-${edgeSeq++}`;

  const nextNodes: RFNode[] = [];
  const nextEdges: RFEdge[] = [];

  // re-parent selected nodes
  for (const n of nodes) {
    if (!selectedIds.has(n.id)) continue;
    const rel = { x: n.position.x - groupPos.x, y: n.position.y - groupPos.y };
    nextNodes.push({ ...n, position: rel, parentId: groupId });
  }
  // keep non-selected
  for (const n of nodes) if (!selectedIds.has(n.id)) nextNodes.push(n);
  // add group + IO
  nextNodes.push(groupNode, groupInputNode, groupOutputNode);

  for (const e of edges) {
    const srcIn = selectedIds.has(e.source);
    const tgtIn = selectedIds.has(e.target);
    if (srcIn && tgtIn) {
      nextEdges.push(e);
      continue;
    }
    if (srcIn && !tgtIn) {
      // inside -> outside, build group output pin
      const srcPin = parseHandleId(e.sourceHandle);
      const key = `${e.source}/${srcPin}`;
      if (!outPinMap.has(key)) {
        const srcNode = nodeById.get(e.source);
        const outs: any[] = (getTpl(srcNode).outputs ?? []) as any[];
        const found = outs.find((p) => (typeof p.id === 'number' ? p.id === srcPin : false));
        const pin = { pinId: nextOutId, name: found?.name ?? `out${nextOutId}`, type: found?.type ?? "float" };
        outPinMap.set(key, pin);
        (groupNode.data as any).template.outputs.push({ id: pin.pinId, name: pin.name, type: pin.type });
        (groupOutputNode.data as any).template.inputs.push({ id: pin.pinId, name: pin.name, type: pin.type, value: undefined });
        nextOutId++;
      }
      const pin = outPinMap.get(key)!;
      // outside: group -> original target
      nextEdges.push({ id: makeEdgeId(groupId, `out-${pin.pinId}`, e.target, e.targetHandle), source: groupId, target: e.target, sourceHandle: `out-${pin.pinId}`, targetHandle: e.targetHandle });
      // inside: original source -> group_output
      nextEdges.push({ id: makeEdgeId(e.source, e.sourceHandle, groupOutputId, `in-${pin.pinId}`), source: e.source, target: groupOutputId, sourceHandle: e.sourceHandle, targetHandle: `in-${pin.pinId}` });
      continue;
    }
    if (!srcIn && tgtIn) {
      // outside -> inside, build group input pin
      const tgtPin = parseHandleId(e.targetHandle);
      const key = `${e.target}/${tgtPin}`;
      if (!inPinMap.has(key)) {
        const dstNode = nodeById.get(e.target);
        const ins: any[] = (getTpl(dstNode).inputs ?? []) as any[];
        const found = ins.find((p) => (typeof p.id === 'number' ? p.id === tgtPin : false));
        const pin = { pinId: nextInId, name: found?.name ?? `in${nextInId}`, type: found?.type ?? "float" };
        inPinMap.set(key, pin);
        (groupNode.data as any).template.inputs.push({ id: pin.pinId, name: pin.name, type: pin.type, value: undefined });
        (groupInputNode.data as any).template.outputs.push({ id: pin.pinId, name: pin.name, type: pin.type });
        nextInId++;
      }
      const pin = inPinMap.get(key)!;
      // outside: original source -> group
      nextEdges.push({ id: makeEdgeId(e.source, e.sourceHandle, groupId, `in-${pin.pinId}`), source: e.source, target: groupId, sourceHandle: e.sourceHandle, targetHandle: `in-${pin.pinId}` });
      // inside: group_input -> original target
      nextEdges.push({ id: makeEdgeId(groupInputId, `out-${pin.pinId}`, e.target, e.targetHandle), source: groupInputId, target: e.target, sourceHandle: `out-${pin.pinId}`, targetHandle: e.targetHandle });
      continue;
    }
    nextEdges.push(e);
  }

  return { nodes: nextNodes, edges: nextEdges, groupId, groupInputId, groupOutputId };
}

export function ungroupGroup(nodes: RFNode[], edges: RFEdge[], groupId: string): { nodes: RFNode[]; edges: RFEdge[] } {
  const group = nodes.find((n) => n.id === groupId);
  if (!group || (group.data as any)?.type !== "group") return { nodes, edges };
  const groupPos = group.position;
  const groupParentId = (group as any).parentId as string | undefined;
  const children = nodes.filter((n) => (n as any).parentId === groupId);
  const groupInput = children.find((n) => (n.data as any)?.type === "group_input");
  const groupOutput = children.find((n) => (n.data as any)?.type === "group_output");
  const groupInputId = groupInput?.id;
  const groupOutputId = groupOutput?.id;

  const internalToOutput = new Map<number, { src: string; sh?: string }>();
  if (groupOutputId) {
    for (const e of edges) {
      if (e.target === groupOutputId) {
        const pin = parseHandleId(e.targetHandle);
        internalToOutput.set(pin, { src: e.source, sh: e.sourceHandle });
      }
    }
  }
  const internalFromInput = new Map<number, { tgt: string; th?: string }>();
  if (groupInputId) {
    for (const e of edges) {
      if (e.source === groupInputId) {
        const pin = parseHandleId(e.sourceHandle);
        internalFromInput.set(pin, { tgt: e.target, th: e.targetHandle });
      }
    }
  }

  let edgeSeq = 0;
  const makeEdgeId = (src: string, sh: string | undefined, tgt: string, th: string | undefined) => `${src}${sh ? `:${sh}` : ""}->${tgt}${th ? `:${th}` : ""}-${edgeSeq++}`;

  const nextEdges: RFEdge[] = [];
  const toRemoveEdgeIds = new Set<string>();

  // reconnect external edges referencing the group
  for (const e of edges) {
    if (e.source === groupId) {
      const pin = parseHandleId(e.sourceHandle);
      const map = internalToOutput.get(pin);
      if (map) {
        nextEdges.push({ id: makeEdgeId(map.src, map.sh, e.target, e.targetHandle), source: map.src, target: e.target, sourceHandle: map.sh, targetHandle: e.targetHandle });
      }
      toRemoveEdgeIds.add(e.id);
      continue;
    }
    if (e.target === groupId) {
      const pin = parseHandleId(e.targetHandle);
      const map = internalFromInput.get(pin);
      if (map) {
        nextEdges.push({ id: makeEdgeId(e.source, e.sourceHandle, map.tgt, map.th), source: e.source, target: map.tgt, sourceHandle: e.sourceHandle, targetHandle: map.th });
      }
      toRemoveEdgeIds.add(e.id);
      continue;
    }
  }

  // remove internal wiring to IO
  if (groupOutputId) for (const e of edges) if (e.target === groupOutputId) toRemoveEdgeIds.add(e.id);
  if (groupInputId) for (const e of edges) if (e.source === groupInputId) toRemoveEdgeIds.add(e.id);

  // keep all other edges
  for (const e of edges) if (!toRemoveEdgeIds.has(e.id)) nextEdges.push(e);

  // move children out (skip IO nodes)
  const movedChildren = children
    .filter((n) => (n.data as any)?.type !== "group_input" && (n.data as any)?.type !== "group_output")
    .map((n) => ({ ...n, parentId: groupParentId, position: { x: n.position.x + groupPos.x, y: n.position.y + groupPos.y } }));

  const removeIds = new Set([groupId]);
  if (groupInputId) removeIds.add(groupInputId);
  if (groupOutputId) removeIds.add(groupOutputId);
  const keptNodes = nodes.filter((n) => !removeIds.has(n.id) && (n as any).parentId !== groupId);

  return { nodes: [...keptNodes, ...movedChildren], edges: nextEdges };
}
