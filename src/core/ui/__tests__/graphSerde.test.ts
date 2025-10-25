import { describe, expect, it } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { serializeGraph, inflateGraph } from "../graphSerde";

function makeOverlayNode(id: string, panel: string): Node {
  return {
    id,
    position: { x: 0, y: 0 },
    data: {
      template: {
        id: Number(id),
        type: `editor_${panel}`,
        name: panel,
        meta: ["editor_node", `editor_panel:${panel}`],
        inputs: [],
        outputs: [],
        properties: [],
      },
    },
    width: 320,
    height: 200,
  } as unknown as Node;
}

function makeFloatNode(id: string, value: number): Node {
  return {
    id,
    position: { x: 120, y: 80 },
    data: {
      template: {
        id: Number(id),
        type: "float",
        name: "Float",
        meta: [],
        inputs: [],
        outputs: [],
        properties: [{ id: "value", value }],
      },
    },
    width: 140,
    height: 90,
  } as unknown as Node;
}

describe("graphSerde overlay handling", () => {
  it("excludes overlay nodes during serialization", () => {
    const overlay = makeOverlayNode("99", "preview");
    const floatNode = makeFloatNode("1", 0.5);
    const nodes: Node[] = [overlay, floatNode];
    const edges: Edge[] = [];

    const serialized = serializeGraph(nodes, edges, "Test");
    expect(serialized.nodes).toBeDefined();
    expect(serialized.nodes?.length).toBe(1);
    expect(serialized.nodes?.[0]?.type).toBe("float");
  });

  it("drops overlay nodes when inflating graphs", async () => {
    const raw = {
      name: "Legacy",
      nodes: [
        { id: 10, type: "editor_preview", meta: ["editor_panel:preview"] },
        { id: 2, type: "float", properties: [{ id: "value", value: 1.0 }] },
      ],
    };

    const { graph } = await inflateGraph(raw, async () => undefined);
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(graph.nodes?.length).toBe(1);
    expect(graph.nodes?.[0]?.type).toBe("float");
  });
});
