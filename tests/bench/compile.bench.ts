import { bench, describe } from "vitest";
import { GraphCompiler } from "@/core/compiler/graphCompiler";
import type { Graph, LanguagePack } from "@/core/graph/types";

// Mock language pack for benchmarking
const mockLanguagePack: LanguagePack = {
  name: "Test",
  version: "1.0",
  file_extensions: ["test"],
  coordinates: {
    up: "+y",
    right: "+x",
    forward: "+z",
    handedness: "right",
  },
  nodes: {
    surface: {
      template: ["{{internal_nodes}}"],
    },
    add: {
      template: "float {{name}} = {{inputs:0}} + {{inputs:1}};",
    },
    float: {
      template: "float {{name}} = {{inputs:0}};",
    },
    multiply: {
      template: "float {{name}} = {{inputs:0}} * {{inputs:1}};",
    },
  },
};

// Small graph (< 20 nodes)
function createSmallGraph(): Graph {
  return {
    id: 0,
    type: "surface",
    name: "Surface",
    meta: [],
    position: [0, 0],
    nodes: [
      {
        id: 1,
        type: "float",
        name: "Value1",
        meta: [],
        position: [0, 0],
        nodes: [],
        inputs: [{ id: 0, name: "value", type: ["float"], value: [1.0] }],
        outputs: [{ id: 0, name: "out", type: ["float"] }],
        properties: [],
      },
      {
        id: 2,
        type: "float",
        name: "Value2",
        meta: [],
        position: [100, 0],
        nodes: [],
        inputs: [{ id: 0, name: "value", type: ["float"], value: [2.0] }],
        outputs: [{ id: 0, name: "out", type: ["float"] }],
        properties: [],
      },
      {
        id: 3,
        type: "add",
        name: "Add",
        meta: [],
        position: [200, 0],
        nodes: [],
        inputs: [
          { id: 0, name: "a", type: ["float"], value: [], ref: "../1/0" },
          { id: 1, name: "b", type: ["float"], value: [], ref: "../2/0" },
        ],
        outputs: [{ id: 0, name: "out", type: ["float"] }],
        properties: [],
      },
    ],
    inputs: [],
    outputs: [],
    properties: [],
  };
}

// Medium graph (20-50 nodes)
function createMediumGraph(): Graph {
  const nodes = [];
  
  // Create chain of operations
  for (let i = 0; i < 30; i++) {
    if (i < 15) {
      nodes.push({
        id: i + 1,
        type: "float",
        name: `Value${i}`,
        meta: [],
        position: [i * 50, 0],
        nodes: [],
        inputs: [{ id: 0, name: "value", type: ["float"], value: [i * 0.1] }],
        outputs: [{ id: 0, name: "out", type: ["float"] }],
        properties: [],
      });
    } else {
      const prevA = i - 14;
      const prevB = i - 13;
      nodes.push({
        id: i + 1,
        type: "add",
        name: `Add${i}`,
        meta: [],
        position: [i * 50, 100],
        nodes: [],
        inputs: [
          { id: 0, name: "a", type: ["float"], value: [], ref: `../${prevA}/0` },
          { id: 1, name: "b", type: ["float"], value: [], ref: `../${prevB}/0` },
        ],
        outputs: [{ id: 0, name: "out", type: ["float"] }],
        properties: [],
      });
    }
  }

  return {
    id: 0,
    type: "surface",
    name: "Surface",
    meta: [],
    position: [0, 0],
    nodes,
    inputs: [],
    outputs: [],
    properties: [],
  };
}

// Large graph (50-200 nodes)
function createLargeGraph(): Graph {
  const nodes = [];
  
  // Create complex graph with 100 nodes
  for (let i = 0; i < 100; i++) {
    if (i < 50) {
      nodes.push({
        id: i + 1,
        type: "float",
        name: `Value${i}`,
        meta: [],
        position: [i * 30, Math.floor(i / 10) * 100],
        nodes: [],
        inputs: [{ id: 0, name: "value", type: ["float"], value: [Math.random()] }],
        outputs: [{ id: 0, name: "out", type: ["float"] }],
        properties: [],
      });
    } else {
      const idx = i - 50;
      const prevA = (idx * 2) + 1;
      const prevB = (idx * 2) + 2;
      nodes.push({
        id: i + 1,
        type: idx % 2 === 0 ? "add" : "multiply",
        name: `Op${i}`,
        meta: [],
        position: [i * 30, Math.floor(i / 10) * 100],
        nodes: [],
        inputs: [
          { id: 0, name: "a", type: ["float"], value: [], ref: `../${prevA}/0` },
          { id: 1, name: "b", type: ["float"], value: [], ref: `../${prevB}/0` },
        ],
        outputs: [{ id: 0, name: "out", type: ["float"] }],
        properties: [],
      });
    }
  }

  return {
    id: 0,
    type: "surface",
    name: "Surface",
    meta: [],
    position: [0, 0],
    nodes,
    inputs: [],
    outputs: [],
    properties: [],
  };
}

describe("Shader Compilation Performance", () => {
  bench("small graph (10 nodes)", () => {
    const graph = createSmallGraph();
    const compiler = new GraphCompiler(graph, mockLanguagePack);
    compiler.compile();
  });

  bench("medium graph (30 nodes)", () => {
    const graph = createMediumGraph();
    const compiler = new GraphCompiler(graph, mockLanguagePack);
    compiler.compile();
  });

  bench("large graph (100 nodes)", () => {
    const graph = createLargeGraph();
    const compiler = new GraphCompiler(graph, mockLanguagePack);
    compiler.compile();
  });
});
