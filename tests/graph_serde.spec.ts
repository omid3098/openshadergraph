import { describe, it, expect } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { serializeGraph, inflateGraph } from "@/core/ui/graphSerde";
import { getNodeTemplate } from "@/core/schema/registry";

function cloneTemplate(type: string, id: number) {
  const base = getNodeTemplate(type);
  if (!base) throw new Error(`Template '${type}' not found`);
  const clone = JSON.parse(JSON.stringify(base));
  const defaults = JSON.parse(JSON.stringify(base));
  clone.id = id;
  defaults.id = id;
  const ensureIds = (pins: any[]) => {
    if (!Array.isArray(pins)) return;
    pins.forEach((pin, index) => {
      if (typeof pin.id !== "number") pin.id = index;
    });
  };
  ensureIds(clone.inputs);
  ensureIds(clone.outputs);
  ensureIds(defaults.inputs);
  ensureIds(defaults.outputs);
  return { template: clone, defaults };
}

function makeNode(type: string, id: number, position: { x: number; y: number } = { x: 0, y: 0 }): Node {
  const { template, defaults } = cloneTemplate(type, id);
  return {
    id: String(id),
    type: "graphNode",
    position,
    data: {
      label: template.name ?? type,
      type,
      template,
      templateDefaults: defaults,
    },
  } as any;
}

function lastSavedNode(result: ReturnType<typeof serializeGraph>, type: string) {
  return result.nodes?.find((node) => node.type === type);
}

describe("graph serialization", () => {
  it("omits untouched pins and properties", () => {
    const sampler = makeNode("texture_sampler", 1);
    const output = makeNode("fragment_output", 2);
    const graph = serializeGraph([sampler, output], [] as Edge[], "Delta");
    const savedSampler = lastSavedNode(graph, "texture_sampler");
    expect(savedSampler?.inputs).toBeUndefined();
    expect(savedSampler?.outputs).toBeUndefined();
    expect(savedSampler?.properties).toBeUndefined();
  });

  it("persists explicit input value overrides", () => {
    const sampler = makeNode("texture_sampler", 1);
    (sampler.data as any).template.inputs[1].value = [0.25, 0.75];
    const graph = serializeGraph([sampler], [] as Edge[], "Override");
    const savedSampler = lastSavedNode(graph, "texture_sampler");
    expect(savedSampler?.inputs).toEqual([
      { id: 1, value: [0.25, 0.75] },
    ]);
  });

  it("stores connections only when present", () => {
    const sampler = makeNode("texture_sampler", 1, { x: 0, y: 0 });
    const fragment = makeNode("fragment_output", 2, { x: 320, y: 0 });
    const edges: Edge[] = [
      {
        id: "e1-2-0-0",
        source: "1",
        target: "2",
        sourceHandle: "out-0",
        targetHandle: "in-0",
      } as Edge,
    ];
    const graph = serializeGraph([sampler, fragment], edges, "Connections");
    const savedSampler = lastSavedNode(graph, "texture_sampler");
    const savedFragment = lastSavedNode(graph, "fragment_output");
    expect(savedFragment?.inputs).toEqual([{ id: 0, value: "../1/0" }]);
    expect(savedSampler?.outputs).toEqual([{ id: 0, value: "../2/0" }]);
  });

  it("drops overrides after reverting to template defaults", () => {
    const sampler = makeNode("texture_sampler", 1);
    const uvInput = (sampler.data as any).template.inputs[1];
    uvInput.value = [0.1, 0.2];
    let graph = serializeGraph([sampler], [] as Edge[], "Mutate");
    let savedSampler = lastSavedNode(graph, "texture_sampler");
    expect(savedSampler?.inputs).toEqual([{ id: 1, value: [0.1, 0.2] }]);
    uvInput.value = "builtin:uv";
    graph = serializeGraph([sampler], [] as Edge[], "Mutate");
    savedSampler = lastSavedNode(graph, "texture_sampler");
    expect(savedSampler?.inputs).toBeUndefined();
  });
});

describe("graph inflation", () => {
  it("hydrates saved nodes using current templates", async () => {
    const saved = {
      type: "",
      name: "Legacy",
      nodes: [
        {
          id: 1,
          type: "texture_sampler",
          position: [10, 20],
          inputs: [
            { id: 1, value: [0.25, 0.75] },
          ],
          outputs: [
            { id: 0, value: "../2/0" },
          ],
        },
        {
          id: 2,
          type: "fragment_output",
          position: [420, 20],
          inputs: [
            { id: 0, value: "../1/0" },
          ],
        },
      ],
    };

    const { graph, defaults } = await inflateGraph(saved, async (type) => getNodeTemplate(type));
    expect(Array.isArray(graph.nodes)).toBe(true);
    const sampler = graph.nodes!.find((node) => node.type === "texture_sampler");
    expect(sampler).toBeDefined();
    expect(sampler!.outputs?.length).toBeGreaterThanOrEqual(5);
    expect(sampler!.inputs?.find((pin) => pin.id === 1)?.value).toEqual([0.25, 0.75]);

    const samplerDefaults = defaults.get(1);
    expect(samplerDefaults).toBeDefined();
    expect(samplerDefaults!.inputs?.find((pin) => pin.id === 1)?.value).toEqual("builtin:uv");
  });
});

