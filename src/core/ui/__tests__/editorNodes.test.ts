import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import { collectEditorNodes, computeEditorSpawnPosition, isEditorNodeOfType } from "../editorNodes";

function makeEditorNode(id: string, type: string, parentId?: string, position?: { x: number; y: number }): Node {
  return {
    id,
    type: "graphNode",
    position: position ?? { x: 0, y: 0 },
    data: {
      label: type,
      type,
      template: {
        id: Number(id),
        type,
        name: type,
        meta: ["editor_node"],
        position: [Math.round(position?.x ?? 0), Math.round(position?.y ?? 0)],
        nodes: [],
        inputs: [],
        outputs: [],
        properties: [],
      },
    },
    ...(parentId ? { parentId } : {}),
  } as unknown as Node;
}

describe("editorNodes helpers", () => {
  it("detects editor nodes by template type", () => {
    const node = makeEditorNode("1", "editor_properties");
    expect(isEditorNodeOfType(node, "editor_properties")).toBe(true);
    expect(isEditorNodeOfType(node, "editor_preview")).toBe(false);
  });

  it("collects editor nodes for a parent scope", () => {
    const parentId = "10";
    const nodes: Node[] = [
      makeEditorNode("1", "editor_properties", parentId),
      makeEditorNode("2", "editor_properties"),
      makeEditorNode("3", "editor_preview", parentId),
    ];
    const collected = collectEditorNodes(nodes, "editor_properties", parentId);
    expect(collected.map((n) => n.id)).toEqual(["1"]);
  });

  it("computes spawn position avoiding occupied slots", () => {
    const parentId = "20";
    const nodes: Node[] = [
      makeEditorNode("1", "editor_properties", parentId, { x: 80, y: 80 }),
      makeEditorNode("2", "editor_preview", parentId, { x: 128, y: 80 }),
      makeEditorNode("3", "editor_compile", parentId, { x: 176, y: 80 }),
      makeEditorNode("4", "editor_graph_data", parentId, { x: 224, y: 80 }),
    ];
    const pos = computeEditorSpawnPosition(nodes, parentId);
    expect(pos).toEqual({ x: 80, y: 128 });
  });

  it("defaults spawn position for empty groups", () => {
    const pos = computeEditorSpawnPosition([], undefined);
    expect(pos).toEqual({ x: 80, y: 80 });
  });
});
