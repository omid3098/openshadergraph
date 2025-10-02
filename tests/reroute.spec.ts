import { describe, it, expect } from "vitest";
import { NodeBuilder } from "../src/core/graph/node";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import { loadLanguage, getNodeTemplate } from "../src/core/schema/registry";
import { extractPreviewShaders } from "../src/core/preview/shaderUtils";
import type { Edge, Node } from "@xyflow/react";
import type { NodePaletteItem } from "../src/core/schema/types";
import { createRerouteInsertion } from "../src/core/ui/reroute";

function sanitizeFragment(code: string): string {
  // Helper used in other tests; keep consistent by stripping whitespace for simple matching
  return code.replace(/\s+/g, " ").trim();
}

describe("Reroute node", () => {
  it("acts as a passthrough during compilation", async () => {
    const builder = new NodeBuilder("surface");
    const surface = builder.to_dict();
    const fragmentPass = builder.get_node_by_type("fragment_pass");
    expect(fragmentPass).toBeTruthy();
    const fragmentOutput = fragmentPass ? builder.find_nested_node_by_type(fragmentPass, "fragment_output") : undefined;
    expect(fragmentOutput).toBeTruthy();

    const color = fragmentPass ? builder.create_node("color", fragmentPass) : undefined;
    expect(color).toBeTruthy();
    const reroute = fragmentPass ? builder.create_node("reroute", fragmentPass) : undefined;
    expect(reroute).toBeTruthy();

    if (!fragmentPass || !fragmentOutput || !color || !reroute) throw new Error("Failed to set up graph for reroute test");

    builder.connect_nodes(color, reroute, 0, 0);
    builder.connect_nodes(reroute, fragmentOutput, 0, 0);

    const lang = await loadLanguage("ThreeJS_GLSL.json");
    const compiler = new GraphCompiler(surface, lang);
    compiler.compile();
    const { fragment } = extractPreviewShaders(compiler.result_code);
    const cleaned = sanitizeFragment(fragment);

    expect(cleaned).toMatch(/vec4 color_\d+ = vec4\(1\.0, 1\.0, 1\.0, 1\.0\);/);
    expect(cleaned).toMatch(/gl_FragColor = vec4\(color, outAlpha\);/);
    expect(cleaned).not.toContain("reroute");
  });

  it("splits an edge into two edges when inserted", () => {
    const template = getNodeTemplate("reroute");
    expect(template).toBeTruthy();
    if (!template) throw new Error("Missing reroute template in registry");

    const paletteItem: NodePaletteItem = {
      type: "reroute",
      name: template.name ?? "Reroute",
      path: "logic/reroute.json",
      category: "logic",
    };

    const nodes: Node[] = [
      {
        id: "1",
        type: "graphNode",
        position: { x: 0, y: 0 },
        data: {
          label: "Color",
          type: "color",
          template: {
            id: 1,
            type: "color",
            name: "Color",
            meta: [],
            position: [0, 0],
            nodes: [],
            inputs: [],
            outputs: [{ id: 0, name: "out", type: "float4" }],
            properties: [],
          },
        },
      } as any,
      {
        id: "2",
        type: "graphNode",
        position: { x: 400, y: 0 },
        data: {
          label: "Fragment Output",
          type: "fragment_output",
          template: {
            id: 2,
            type: "fragment_output",
            name: "Fragment Output",
            meta: [],
            position: [0, 0],
            nodes: [],
            inputs: [{ id: 0, name: "Albedo", type: "float3" }],
            outputs: [],
            properties: [],
          },
        },
      } as any,
    ];

    const edge: Edge = {
      id: "e1-2-out-0-in-0",
      source: "1",
      target: "2",
      sourceHandle: "out-0",
      targetHandle: "in-0",
      type: "colored",
    } as any;

    const position = { x: 200, y: 120 };
    const nextId = "3";

    const result = createRerouteInsertion({
      edge,
      nodes,
      edges: [edge],
      template,
      item: paletteItem,
      position,
      nextId,
    });

    expect(result.node.id).toBe(nextId);
    expect(result.node.position).toEqual(position);
    expect((result.node.data as any)?.template?.type).toBe("reroute");

    const ids = result.edges.map((e) => e.id).sort();
    expect(ids).toHaveLength(2);
    expect(result.edges.some((e) => e.source === "1" && e.target === nextId && e.sourceHandle === "out-0" && e.targetHandle === "in-0")).toBe(true);
    expect(result.edges.some((e) => e.source === nextId && e.target === "2" && e.sourceHandle === "out-0" && e.targetHandle === "in-0")).toBe(true);
  });
});
