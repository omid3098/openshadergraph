import { describe, it, expect } from "vitest";
import { buildReactFlowGraph } from "@/core/ui/reactFlowGraph";
import {
  computeDefaultPassLayout,
  DEFAULT_PASS_HORIZONTAL_GAP,
  DEFAULT_PREVIEW_OFFSET_X,
  RF_LAYOUT_DEFAULTS,
} from "@/core/ui/layoutDefaults";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("layout defaults", () => {
  it("computes aligned positions for surface passes", () => {
    const layout = computeDefaultPassLayout();

    expect(layout.vertexPass[0]).toBe(RF_LAYOUT_DEFAULTS.baseX + RF_LAYOUT_DEFAULTS.depthX);
    expect(layout.vertexPass[1]).toBe(RF_LAYOUT_DEFAULTS.baseY);

    expect(layout.vertexOutput[0]).toBe(layout.vertexPass[0] + RF_LAYOUT_DEFAULTS.depthX);
    expect(layout.vertexOutput[1]).toBe(layout.vertexPass[1]);

    expect(layout.fragmentPass[0]).toBe(layout.vertexOutput[0] + DEFAULT_PASS_HORIZONTAL_GAP);
    expect(layout.fragmentPass[1]).toBe(layout.vertexPass[1]);

    expect(layout.fragmentOutput[0]).toBe(layout.fragmentPass[0] + RF_LAYOUT_DEFAULTS.depthX);
    expect(layout.fragmentOutput[1]).toBe(layout.fragmentPass[1]);

    expect(layout.preview[0]).toBe(layout.fragmentOutput[0] + DEFAULT_PREVIEW_OFFSET_X);
    expect(layout.preview[1]).toBe(layout.fragmentPass[1]);
  });

  it("respects explicit pass positions when building ReactFlow graph", () => {
    const layout = computeDefaultPassLayout();

    const surface = {
      id: 1,
      type: "surface",
      nodes: [
        {
          id: 2,
          type: "vertex_pass",
          position: layout.vertexPass,
          nodes: [
            {
              id: 3,
              type: "vertex_output",
              position: layout.vertexOutput,
              inputs: [],
              outputs: [],
            },
          ],
          inputs: [],
          outputs: [],
        },
        {
          id: 4,
          type: "fragment_pass",
          position: layout.fragmentPass,
          nodes: [
            {
              id: 5,
              type: "fragment_output",
              position: layout.fragmentOutput,
              inputs: [],
              outputs: [],
            },
          ],
          inputs: [],
          outputs: [],
        },
      ],
      inputs: [],
      outputs: [],
    };

    const defaults = new Map<number, unknown>();
    const capture = (node: any) => {
      defaults.set(node.id, clone(node));
      for (const child of node.nodes ?? []) capture(child);
    };
    capture(surface);

    const rf = buildReactFlowGraph({
      root: surface as any,
      defaults: defaults as Map<number, any>,
      options: {},
    });

    const vertexNode = rf.nodes.find((n) => n.data?.type === "vertex_pass");
    const fragmentNode = rf.nodes.find((n) => n.data?.type === "fragment_pass");
    const vertexOutputNode = rf.nodes.find((n) => n.data?.type === "vertex_output");
    const fragmentOutputNode = rf.nodes.find((n) => n.data?.type === "fragment_output");

    expect(vertexNode?.position).toEqual({ x: layout.vertexPass[0], y: layout.vertexPass[1] });
    expect(fragmentNode?.position).toEqual({ x: layout.fragmentPass[0], y: layout.fragmentPass[1] });
    expect(vertexOutputNode?.position).toEqual({ x: layout.vertexOutput[0], y: layout.vertexOutput[1] });
    expect(fragmentOutputNode?.position).toEqual({ x: layout.fragmentOutput[0], y: layout.fragmentOutput[1] });
  });
});
