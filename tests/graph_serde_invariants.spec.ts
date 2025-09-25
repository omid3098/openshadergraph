import { describe, it, expect } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { serializeGraph, inflateGraph } from "@/core/ui/graphSerde";
import { getNodeTemplate } from "@/core/schema/registry";

function makeNode(type: string, id: number, position: { x: number; y: number } = { x: 0, y: 0 }): Node {
  const base = getNodeTemplate(type)!;
  const template = JSON.parse(JSON.stringify(base));
  const defaults = JSON.parse(JSON.stringify(base));
  template.id = id;
  defaults.id = id;
  const ensureIds = (pins: any[]) => {
    if (!Array.isArray(pins)) return;
    pins.forEach((pin, index) => {
      if (typeof pin.id !== "number") pin.id = index;
    });
  };
  ensureIds(template.inputs);
  ensureIds(template.outputs);
  ensureIds(defaults.inputs);
  ensureIds(defaults.outputs);
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

describe("serde invariants: order and ids", () => {
  it("preserves child order and integer ids across inflate/serialize cycles", async () => {
    // Build a small graph with deterministic order: sampler -> fragment_output
    const sampler = makeNode("texture_sampler", 1, { x: 0, y: 0 });
    const fragment = makeNode("fragment_output", 2, { x: 320, y: 0 });
    const edges: Edge[] = [
      { id: "e1-2-0-0", source: "1", target: "2", sourceHandle: "out-0", targetHandle: "in-0" } as Edge,
    ];
    const saved1 = serializeGraph([sampler, fragment], edges, "Invariant");

    // Ensure IDs are integers in saved form
    const ids = (saved1.nodes ?? []).map((n) => n.id);
    expect(ids.every((id) => Number.isInteger(id))).toBe(true);

    // Inflate, then serialize again after a benign property edit and revert
    const inflated = await inflateGraph({ type: "", name: "G", nodes: saved1.nodes }, async (type) => getNodeTemplate(type));
    const inflatedRoot = inflated.graph;
    // Make an edit: change a property, then revert to default
    const frag = inflatedRoot.nodes!.find((n) => n.type === "fragment_output")!;
    const propIndex = (frag.properties ?? []).findIndex((p: any) => p && p.id === "shading_model");
    if (propIndex >= 0) {
      (frag.properties as any)[propIndex] = { ...(frag.properties as any)[propIndex], value: "unlit" };
      (frag.properties as any)[propIndex] = { ...(frag.properties as any)[propIndex], value: undefined };
    }

    // Serialize the inflated graph back through the UI serializer
    // Reconstruct Node/Edge arrays roughly in the same order
    const rfSampler = makeNode("texture_sampler", 1, { x: 0, y: 0 });
    const rfFragment = makeNode("fragment_output", 2, { x: 320, y: 0 });
    const saved2 = serializeGraph([rfSampler, rfFragment], edges, "Invariant");

    const ids2 = (saved2.nodes ?? []).map((n) => n.id);
    expect(ids2).toEqual(ids);

    // Child order should remain [texture_sampler, fragment_output]
    const types = (saved2.nodes ?? []).map((n) => n.type);
    expect(types).toEqual(["texture_sampler", "fragment_output"]);
  });
});


