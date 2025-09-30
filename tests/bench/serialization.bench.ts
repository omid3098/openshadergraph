import { bench, describe } from "vitest";
import { serializeGraph } from "@/core/ui/graphSerde";
import type { Graph } from "@/core/graph/types";

// Create test graph
function createTestGraph(nodeCount: number): Graph {
  const nodes: Graph[] = [];
  
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: i + 1,
      type: "float",
      name: `Node${i}`,
      meta: [],
      position: [i * 50, Math.floor(i / 10) * 100],
      nodes: [],
      inputs: [{ id: 0, name: "value", type: ["float"], value: [i * 0.1] }],
      outputs: [{ id: 0, name: "out", type: ["float"] }],
      properties: [],
    });
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

describe("Graph Serialization Performance", () => {
  bench("serialize small graph (10 nodes)", () => {
    const graph = createTestGraph(10);
    serializeGraph(graph);
  });

  bench("serialize medium graph (50 nodes)", () => {
    const graph = createTestGraph(50);
    serializeGraph(graph);
  });

  bench("serialize large graph (200 nodes)", () => {
    const graph = createTestGraph(200);
    serializeGraph(graph);
  });

  // Note: inflate benchmarks skipped as they require async loadTemplate function
  // Serialization is the more critical path for performance
});
