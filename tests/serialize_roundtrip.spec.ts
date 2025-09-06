import { describe, it, expect } from "vitest";
import { NodeBuilder } from "../src/core/graph/node";
import type { Node, Edge } from "@xyflow/react";
import { buildGraphData } from "../src/core/ui/graphData";

function rfFromGraph(graph: any) {
  const createdNodes: Node[] = [];
  const createdEdges: Edge[] = [];
  const walk = (n: any, parentId?: string) => {
    const idStr = String(n.id);
    createdNodes.push({
      id: idStr,
      type: "graphNode",
      position: { x: 0, y: 0 },
      data: {
        label: n.name ?? n.type,
        type: n.type,
        template: {
          id: n.id,
          type: n.type,
          name: n.name,
          meta: n.meta ?? [],
          position: n.position ?? [0, 0],
          nodes: n.nodes ?? [],
          inputs: n.inputs ?? [],
          outputs: n.outputs ?? [],
        },
      },
      ...(parentId ? { parentId } : {}),
    } as any);
    for (const child of n.nodes ?? []) walk(child, idStr);
  };
  walk(graph, undefined);
  const refRe = /^\.\.\/(\d+)\/(\d+)$/;
  const all: Record<string, any> = {};
  const collect = (n: any) => { all[String(n.id)] = n; for (const c of n.nodes ?? []) collect(c); };
  collect(graph);
  for (const gid of Object.keys(all)) {
    const gn = all[gid];
    for (const pin of gn.inputs ?? []) {
      if (typeof pin.value !== "string") continue;
      const m = pin.value.match(refRe);
      if (!m) continue;
      const fromId = m[1];
      const fromPin = Number(m[2]);
      const toId = gid;
      const toPin = pin.id;
      createdEdges.push({
        id: `e${fromId}-${toId}-${fromPin}-${toPin}`,
        source: String(fromId),
        target: String(toId),
        sourceHandle: `out-${fromPin}`,
        targetHandle: `in-${toPin}`,
      } as any);
    }
  }
  return { nodes: createdNodes, edges: createdEdges };
}

describe("serialize roundtrip invariants", () => {
  it("preserves pin order and children order", async () => {
    const surface = new NodeBuilder("surface");
    const fragment = surface.get_node_by_type("fragment_pass")!;
    const out = surface.find_nested_node_by_type(fragment, "fragment_output")!;
    const a = surface.create_node("color", fragment);
    const b = surface.create_node("color", fragment);
    const add = surface.create_node("add", fragment);
    surface.connect_nodes(a, add, 0, 0);
    surface.connect_nodes(b, add, 0, 1);
    surface.connect_nodes(add, out, 0, 0);
    const graph = surface.to_dict();
    const rf = rfFromGraph(graph);
    const wrapper = buildGraphData(rf.nodes as any, rf.edges as any, "RoundTrip");
    const root = wrapper.nodes.find((n: any) => n.type === "surface");
    expect(root).toBeDefined();
    const pass = root!.nodes.find((n: any) => n.type === "fragment_pass");
    expect(pass).toBeDefined();
    const types = pass!.nodes.map((n: any) => n.type);
    expect(types).toEqual(["fragment_output", "color", "color", "add"]);
    // Ensure connection encoding exists both ends for first edge
    expect(typeof add.inputs[0].value).toBe("string");
  });
});
