import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { applyDuplicateSelection } from "../duplicateSelection";
import type { DuplicateNodesResult } from "@/core/graph/duplicate";

describe("applyDuplicateSelection", () => {
  const makeNode = (id: string, selected = false): Node => ({
    id,
    type: "graphNode",
    position: { x: 0, y: 0 },
    data: { label: id },
    selected,
  } as Node);

  const makeEdge = (id: string, source: string, target: string): Edge => ({
    id,
    source,
    target,
  } as Edge);

  it("marks original nodes as deselected and new nodes as selected", () => {
    const nodes = [makeNode("1", true), makeNode("2", false)];
    const edges: Edge[] = [];
    const duplicate: DuplicateNodesResult = {
      nodesToAdd: [makeNode("3", false)],
      edgesToAdd: [],
      selection: ["3"],
      idMap: new Map([["1", "3"]]),
    };

    const { nodes: nextNodes } = applyDuplicateSelection({
      nodes,
      edges,
      selectedIds: new Set(["1"]),
      duplicate,
    });

    const original = nextNodes.find((n) => n.id === "1");
    const duplicateNode = nextNodes.find((n) => n.id === "3");
    expect(original?.selected).toBe(false);
    expect(duplicateNode?.selected).toBe(true);
  });

  it("appends duplicate edges to the edge list", () => {
    const nodes = [makeNode("1", true)];
    const edges = [makeEdge("e1", "1", "2")];
    const duplicate: DuplicateNodesResult = {
      nodesToAdd: [makeNode("3")],
      edgesToAdd: [makeEdge("e2", "3", "4")],
      selection: ["3"],
      idMap: new Map([[
        "1",
        "3",
      ]]),
    };

    const { edges: nextEdges } = applyDuplicateSelection({
      nodes,
      edges,
      selectedIds: new Set(["1"]),
      duplicate,
    });

    expect(nextEdges).toHaveLength(2);
    expect(nextEdges.some((e) => e.id === "e2")).toBe(true);
  });

  it("returns original collections when duplicate payload is empty", () => {
    const nodes = [makeNode("1", true)];
    const edges = [makeEdge("e1", "1", "2")];
    const duplicate: DuplicateNodesResult = {
      nodesToAdd: [],
      edgesToAdd: [],
      selection: [],
      idMap: new Map(),
    };

    const { nodes: nextNodes, edges: nextEdges } = applyDuplicateSelection({
      nodes,
      edges,
      selectedIds: new Set(["1"]),
      duplicate,
    });

    expect(nextNodes).toBe(nodes);
    expect(nextEdges).toBe(edges);
  });
});

