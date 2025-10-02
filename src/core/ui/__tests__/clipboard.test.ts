// @ts-nocheck
import { describe, expect, it } from "vitest";
import type { Graph, GraphNode } from "@/core/graph/types";
import { createClipboardPayload, parseClipboardPayload, remapClipboardNodes } from "../clipboard";

function makeNode(id: number, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    type: "test_node",
    name: `Node ${id}`,
    position: [id * 10, id * 5],
    meta: [],
    nodes: [],
    inputs: [],
    outputs: [],
    properties: [],
    ...overrides,
  } as GraphNode;
}

describe("clipboard helpers", () => {
  const graph: Graph = {
    id: 0,
    type: "root",
    name: "",
    meta: [],
    nodes: [
      makeNode(1, {
        inputs: [
          { id: 0, name: "A", type: "float", value: "../2/0" },
          { id: 1, name: "B", type: "float" },
        ],
        outputs: [{ id: 0, name: "Result", type: "float", value: "../3/0" }],
      }),
      makeNode(2, {
        outputs: [{ id: 0, name: "Value", type: "float", value: "../1/0" }],
      }),
      makeNode(3, {
        inputs: [{ id: 0, name: "In", type: "float", value: "../1/0" }],
      }),
    ],
    inputs: [],
    outputs: [],
    properties: [],
  } as Graph;

  const parentLookup = (id: number) => (id === 3 ? 5 : null);

  it("creates a payload with sanitized connections", () => {
    const payload = createClipboardPayload({
      graph,
      selectedIds: new Set([1, 2]),
      parentLookup,
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 80 },
    });
    expect(payload).not.toBeNull();
    expect(payload?.nodes.length).toBe(2);
    const node1 = payload?.nodes.find((n) => n.id === 1)!;
    const node2 = payload?.nodes.find((n) => n.id === 2)!;
    expect(node1.inputs?.[0]?.value).toBe("../2/0");
    // Node1 output points to node 3 (not selected) so should be stripped
    expect(node1.outputs?.[0]?.value).toBeUndefined();
    // Node2 output referencing node1 remains because both selected
    expect(node2.outputs?.[0]?.value).toBe("../1/0");
  });

  it("parses payload JSON and validates nodes", () => {
    const original = createClipboardPayload({
      graph,
      selectedIds: new Set([1, 2]),
      parentLookup,
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 80 },
    });
    expect(original).not.toBeNull();
    const text = JSON.stringify(original);
    const parsed = parseClipboardPayload(text);
    expect(parsed.nodes.length).toBe(original!.nodes.length);
    expect(parsed.parents.length).toBe(original!.parents.length);
    expect(parsed.bounds).toEqual(original!.bounds);
  });

  it("remaps node ids and offsets only roots", () => {
    const payload = createClipboardPayload({
      graph,
      selectedIds: new Set([1, 3]),
      parentLookup,
      bounds: { minX: 0, minY: 0, maxX: 40, maxY: 30 },
    });
    expect(payload).not.toBeNull();
    const allocateId = (() => {
      let cursor = 10;
      return () => ++cursor;
    })();
    const { nodes, idMap, parentAssignments } = remapClipboardNodes({
      payload: payload!,
      allocateId,
      offset: { x: 16, y: 16 },
    });
    expect(nodes.length).toBe(2);
    nodes.forEach((node) => {
      expect(node.id).toBeGreaterThan(10);
    });
    const node1 = nodes.find((n) => idMap.get(1) === n.id)!;
    const node3 = nodes.find((n) => idMap.get(3) === n.id)!;
    expect(node1.position).toEqual([1 * 10 + 16, 1 * 5 + 16]);
    // Node3 had parent outside selection (id 5), so treated as root -> offset applied
    expect(node3.position).toEqual([3 * 10 + 16, 3 * 5 + 16]);
    // Connections remapped
    expect(node3.inputs?.[0]?.value).toBe(`../${node1.id}/${0}`);
    expect(parentAssignments.get(node1.id)).toBeNull();
    expect(parentAssignments.get(node3.id)).toBe(5);
  });

  it("does not double offset child nodes when parent selected", () => {
    const groupGraph: Graph = {
      id: 0,
      type: "root",
      meta: [],
      nodes: [
        makeNode(10, {
          position: [100, 100],
          nodes: [makeNode(11, { position: [20, 20], inputs: [], outputs: [] })],
        }),
      ],
      inputs: [],
      outputs: [],
      properties: [],
    } as Graph;
    const payload = createClipboardPayload({
      graph: groupGraph,
      selectedIds: new Set([10, 11]),
      parentLookup: (id) => (id === 11 ? 10 : null),
      bounds: { minX: 0, minY: 0, maxX: 200, maxY: 200 },
    });
    expect(payload).not.toBeNull();
    const allocateId = (() => {
      let cursor = 20;
      return () => ++cursor;
    })();
    const { nodes, idMap } = remapClipboardNodes({
      payload: payload!,
      allocateId,
      offset: { x: 32, y: 32 },
    });
    const newParent = nodes.find((n) => n.id === idMap.get(10))!;
    const newChild = nodes.find((n) => n.id === idMap.get(11))!;
    expect(newParent.position).toEqual([132, 132]);
    // child relative position should remain unchanged (no additional offset)
    expect(newChild.position).toEqual([20, 20]);
  });
});

