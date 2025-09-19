import { describe, it, expect } from "vitest";
import { NodeBuilder } from "../src/core/graph/node";
import type { Node, Edge } from "@xyflow/react";
import { buildGraphData } from "../src/core/ui/graphData";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import { loadLanguage } from "../src/core/schema/registry";

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
          properties: n.properties ?? [],
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

describe("UI graph build + edit + compile", () => {
  it("keeps node parenting when editing input and compiles", async () => {
    // Build the same as 'basic_color' example
    const surface = new NodeBuilder("surface");
    const fragment_pass = surface.get_node_by_type("fragment_pass")!;
    const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
    const color = surface.create_node("color", fragment_pass);
    surface.connect_nodes(color, fragment_output, 0, 0);
    const graph = surface.to_dict();

    // Convert to ReactFlow nodes/edges
    const rf = rfFromGraph(graph);

    // Simulate user editing the color node input to red
    const colorNode = rf.nodes.find((n: any) => (n.data?.type ?? n.data?.template?.type) === "color")!;
    expect(colorNode.parentId).toBeDefined(); // nested under fragment_pass
    const tpl = colorNode.data!.template as any;
    tpl.inputs[0].value = [1, 0, 0, 1];

    // Build canonical graph JSON from RF state
    const wrapper = buildGraphData(rf.nodes as any, rf.edges as any, "Test");
    const surfaceNode = (wrapper.nodes as any[]).find((n) => n.type === "surface");
    expect(surfaceNode).toBeDefined();
    const pass = (surfaceNode!.nodes as any[]).find((n) => n.type === "fragment_pass");
    expect(pass).toBeDefined();
    const passChildrenTypes = new Set((pass!.nodes as any[]).map((n: any) => n.type));
    expect(passChildrenTypes.has("color")).toBe(true);
    expect(passChildrenTypes.has("fragment_output")).toBe(true);
    const vertexPass = (surfaceNode!.nodes as any[]).find((n) => n.type === "vertex_pass");
    expect(vertexPass).toBeDefined();
    const vertexChildTypes = new Set((vertexPass!.nodes as any[]).map((n: any) => n.type));
    expect(vertexChildTypes.has("vertex_output")).toBe(true);

    // Compile using ThreeJS_GLSL to ensure refs resolve
    const lang = await loadLanguage("ThreeJS_GLSL.json");
    const compiler = new GraphCompiler(surfaceNode!, lang);
    compiler.compile();
    const code = compiler.result_code;
    expect(code).toMatch(/precision highp float;/);
    expect(code).toMatch(/gl_FragColor\s*=\s*vec4\(/);
  });

  it("persists editor node size metadata from ReactFlow dimensions", () => {
    const editorNode: Node = {
      id: "1",
      type: "graphNode",
      position: { x: 0, y: 0 },
      width: 512,
      height: 384,
      data: {
        label: "Properties",
        type: "editor_properties",
        template: {
          id: 1,
          type: "editor_properties",
          name: "Properties",
          meta: ["editor_node", "editor_panel:properties", "editor_size:360x320"],
          position: [0, 0],
          nodes: [],
          inputs: [],
          outputs: [],
          properties: [],
        },
      },
    } as any;
    const result = buildGraphData([editorNode] as any, [], "TestGraph");
    expect(Array.isArray(result.nodes)).toBe(true);
    const stored = (result.nodes as any[])[0];
    expect(stored.meta).toContain("editor_node");
    expect(stored.meta).toContain("editor_panel:properties");
    expect(stored.meta).toContain("editor_size:512x384");
  });

  it("derives editor node size from ReactFlow dimensions payload", () => {
    const editorNode: Node = {
      id: "2",
      type: "graphNode",
      position: { x: 0, y: 0 },
      dimensions: { width: 640, height: 480 },
      data: {
        label: "Preview",
        type: "editor_preview",
        template: {
          id: 2,
          type: "editor_preview",
          name: "Preview",
          meta: ["editor_node", "editor_panel:preview", "editor_size:520x360"],
          position: [0, 0],
          nodes: [],
          inputs: [],
          outputs: [],
          properties: [],
        },
      },
    } as any;
    const result = buildGraphData([editorNode] as any, [], "TestGraph");
    const stored = (result.nodes as any[])[0];
    expect(stored.meta).toContain("editor_size:640x480");
  });
});
