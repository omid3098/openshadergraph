import { describe, it, expect } from "vitest";
import type { GraphNode } from "../src/core/graph/types";
import type { NodeTemplate } from "../src/core/schema/types";
import { buildReactFlowGraph, type AssetRegistry } from "../src/core/ui/reactFlowGraph";

describe("buildReactFlowGraph", () => {
  const surface: GraphNode = {
    id: 1,
    type: "surface",
    nodes: [],
    inputs: [],
    outputs: [],
    properties: [],
  } as any;

  it("produces ReactFlow nodes and edges with defaults", () => {
    const fragmentOutput: GraphNode = {
      id: 3,
      type: "fragment_output",
      nodes: [],
      inputs: [
        { id: 0, name: "albedo", type: "float3", value: "../2/0" } as any,
      ],
      outputs: [],
      properties: [],
    } as any;
    const fragmentPass: GraphNode = {
      id: 2,
      type: "fragment_pass",
      nodes: [fragmentOutput],
      inputs: [],
      outputs: [],
      properties: [],
    } as any;
    fragmentOutput.parent = fragmentPass;
    surface.nodes = [fragmentPass];
    fragmentPass.parent = surface;

    const defaults = new Map<number, NodeTemplate>([
      [3, { id: 3, type: "fragment_output", properties: [{ id: "shading_model", type: "enum", value: "pbr" }] } as any],
    ]);

    const result = buildReactFlowGraph({ root: surface, defaults });
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(1);
    const fragNode = result.nodes.find((n) => (n.data as any).type === "fragment_output");
    expect(fragNode?.data).toHaveProperty("templateDefaults");
    expect(result.defaultViewPath).toEqual(["1", "2"]);
  });

  it("applies assets from asset property tokens", () => {
    const textureNode: GraphNode = {
      id: 4,
      type: "texture",
      meta: [],
      nodes: [],
      inputs: [],
      outputs: [],
      properties: [{ id: "source", value: "asset:texture-one" }],
    } as any;
    surface.nodes = [textureNode];
    const registry: AssetRegistry = {
      byId: new Map([
        [
          "texture-one",
          { id: "texture-one", source: "res://tex.png", label: "Tex", type: "texture", builtin: true },
        ],
      ]),
      bySource: new Map(),
    };
    const result = buildReactFlowGraph({ root: surface, assets: registry });
    const texNode = result.nodes.find((n) => n.id === "4");
    expect(texNode?.data).toMatchObject({
      asset: {
        id: "texture-one",
        source: "res://tex.png",
        label: "Tex",
      },
    });
  });
});
