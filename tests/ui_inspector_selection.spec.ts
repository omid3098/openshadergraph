import { describe, expect, it } from "vitest";
import { resolveInspectorNodeId, type InspectorNodeLike } from "@/core/ui/inspector";

function makeNode(id: string, meta?: string[]): InspectorNodeLike {
  return {
    id,
    data: {
      template: {
        meta,
      },
    },
  };
}

describe("resolveInspectorNodeId", () => {
  it("selects the first non-editor node from the current selection", () => {
    const nodes = new Map<string, InspectorNodeLike>([
      ["properties", makeNode("properties", ["editor_node"])],
      ["surface", makeNode("surface")],
    ]);

    const result = resolveInspectorNodeId({
      previous: null,
      selectedNodes: [nodes.get("properties")!, nodes.get("surface")!],
      nodesById: nodes,
    });

    expect(result).toBe("surface");
  });

  it("keeps the previous non-editor node when only editor nodes are selected", () => {
    const graphNodes = new Map<string, InspectorNodeLike>([
      ["properties", makeNode("properties", ["editor_node"])],
      ["surface", makeNode("surface")],
    ]);

    const result = resolveInspectorNodeId({
      previous: "surface",
      selectedNodes: [graphNodes.get("properties")!],
      nodesById: graphNodes,
    });

    expect(result).toBe("surface");
  });

  it("returns null when selection is empty", () => {
    const nodes = new Map<string, InspectorNodeLike>();

    const result = resolveInspectorNodeId({
      previous: "surface",
      selectedNodes: [],
      nodesById: nodes,
    });

    expect(result).toBeNull();
  });

  it("returns null when the previous node is missing or editor-only", () => {
    const nodes = new Map<string, InspectorNodeLike>([
      ["properties", makeNode("properties", ["editor_node"])],
    ]);

    const missingPrev = resolveInspectorNodeId({
      previous: "surface",
      selectedNodes: [nodes.get("properties")!],
      nodesById: nodes,
    });

    expect(missingPrev).toBeNull();

    const editorPrev = resolveInspectorNodeId({
      previous: "properties",
      selectedNodes: [nodes.get("properties")!],
      nodesById: nodes,
    });

    expect(editorPrev).toBeNull();
  });
});
