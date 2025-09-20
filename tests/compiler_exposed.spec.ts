import { describe, it, expect } from "vitest";
import type { GraphNode, Graph } from "../src/core/graph/types";
import type { LanguagePack } from "../src/core/schema/types";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";

const testLanguage: LanguagePack = {
  name: "TestLang",
  version: "0.1.0",
  file_extensions: ["glsl"],
  nodes: {
    root: {
      template: "{{meta}}\n{{internal_nodes}}\n{{exposed_nodes}}",
    },
    color_constant: {
      template: "vec4 {{name}} = vec4({{inputs:0}});",
      outputs: {
        default: "{{name}}",
      },
    },
    exposed_passthrough: {
      template: "{{type}} {{name}} = {{inputs:0}};",
      outputs: {
        default: "{{name}}",
      },
    },
  },
  meta: {
    exposed: {
      template: "uniform {{definition}}",
    },
  },
};

function buildGraph(): Graph {
  const colorNode: GraphNode = {
    id: 2,
    type: "color_constant",
    nodes: [],
    inputs: [
      {
        id: 0,
        name: "value",
        type: "float4",
        value: [1, 0, 0, 1],
      },
    ],
    outputs: [
      {
        id: 0,
        name: "value",
        type: "float4",
      },
    ],
    properties: [],
  };

  const exposedNode: GraphNode = {
    id: 3,
    type: "exposed_passthrough",
    nodes: [],
    inputs: [
      {
        id: 0,
        name: "value",
        type: "float4",
        value: "../2/0",
      },
    ],
    outputs: [
      {
        id: 0,
        name: "value",
        type: "float4",
      },
    ],
    properties: [],
    meta: ["exposed"],
  };

  const root: GraphNode = {
    id: 1,
    type: "root",
    nodes: [colorNode, exposedNode],
    inputs: [],
    outputs: [],
    properties: [],
  };

  return root;
}

describe("GraphCompiler exposed node rendering", () => {
  it("hydrates type placeholders when rendering exposed definitions", () => {
    const graph = buildGraph();
    const compiler = new GraphCompiler(graph, testLanguage);
    compiler.compile();

    const code = compiler.result_code;
    expect(code).not.toContain("{{type}}");
    expect(code).toContain("vec4 color_constant_2 = vec4(1.0, 0.0, 0.0, 1.0);");
    expect(code).toContain("uniform vec4 exposed_passthrough_3 = color_constant_2;");
  });
});
