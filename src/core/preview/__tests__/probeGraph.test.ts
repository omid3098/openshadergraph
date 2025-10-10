// @ts-nocheck
import { describe, expect, it } from "vitest";
import type { Graph, GraphNode } from "@/core/graph/types";
import { buildProbeGraph } from "@/core/preview/probeGraph";

function makeFragmentOutput(id: number): GraphNode {
  return {
    id,
    type: "fragment_output",
    name: "FragmentOutput",
    nodes: [],
    inputs: [
      { id: 0, name: "Albedo", type: "float3", value: [1, 1, 1] },
      { id: 1, name: "Roughness", type: "float", value: [0.5] },
      { id: 2, name: "Metallic", type: "float", value: [0.0] },
      { id: 3, name: "Emission", type: "float3", value: [0, 0, 0] },
      { id: 4, name: "Normal", type: "float3", value: [0, 0, 1] },
      { id: 5, name: "Alpha", type: "float", value: [1.0] },
      { id: 23, name: "Emission Strength", type: "float", value: [1.0] },
    ],
    outputs: [],
    properties: [
      { id: "shading_model", label: "Shading", type: "enum", value: "pbr", default: "pbr", options: [] },
      { id: "enable_clearcoat", label: "Clearcoat", type: "boolean", value: false, default: false },
      { id: "enable_transmission", label: "Transmission", type: "boolean", value: false, default: false },
      { id: "enable_sss", label: "SSS", type: "boolean", value: false, default: false },
      { id: "enable_sheen", label: "Sheen", type: "boolean", value: false, default: false },
      { id: "enable_anisotropy", label: "Anisotropy", type: "boolean", value: false, default: false },
      { id: "enable_refraction", label: "Refraction", type: "boolean", value: false, default: false },
      { id: "enable_backlight", label: "Backlight", type: "boolean", value: false, default: false },
    ],
  } as unknown as GraphNode;
}

function makeSurfaceGraph(nodes: GraphNode[]): Graph {
  const fragmentPass: GraphNode = {
    id: 3,
    type: "fragment_pass",
    name: "FragmentPass",
    nodes,
    inputs: [],
    outputs: [],
    properties: [],
  } as GraphNode;

  const vertexOutput: GraphNode = {
    id: 5,
    type: "vertex_output",
    nodes: [],
    inputs: [],
    outputs: [],
    properties: [],
  } as GraphNode;

  const vertexPass: GraphNode = {
    id: 4,
    type: "vertex_pass",
    name: "VertexPass",
    nodes: [vertexOutput],
    inputs: [],
    outputs: [],
    properties: [],
  } as GraphNode;

  const surface: GraphNode = {
    id: 2,
    type: "surface",
    name: "Surface",
    nodes: [vertexPass, fragmentPass],
    inputs: [],
    outputs: [],
    properties: [],
  } as GraphNode;

  return {
    type: "",
    name: "Test",
    nodes: [surface],
    inputs: [],
    outputs: [],
  } as Graph;
}

describe("buildProbeGraph", () => {
  it("includes upstream dependencies and rewrites fragment output", () => {
    const uvNode: GraphNode = {
      id: 10,
      type: "uv",
      name: "UV",
      nodes: [],
      inputs: [],
      outputs: [{ id: 0, name: "uv", type: "float2" }],
      properties: [],
    } as GraphNode;

    const probeNode: GraphNode = {
      id: 20,
      type: "editor_probe",
      name: "Probe",
      meta: ["editor_node", "editor_widget:probe"],
      nodes: [],
      inputs: [{ id: 0, name: "input", type: ["float2"], value: "../10/0" }],
      outputs: [],
      properties: [],
    } as unknown as GraphNode;

    const fragmentOutput = makeFragmentOutput(30);
    const graph = makeSurfaceGraph([uvNode, fragmentOutput, probeNode]);

    const result = buildProbeGraph(graph, 20);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;

    const surface = result.graph.nodes?.[0];
    expect(surface?.type).toBe("surface");
    const fragmentPass = surface?.nodes?.find((n) => n.type === "fragment_pass");
    expect(fragmentPass).toBeTruthy();
    const nodes = fragmentPass?.nodes ?? [];
    expect(nodes.some((n) => n.type === "editor_probe")).toBe(false);
    const uvClone = nodes.find((n) => n.type === "uv");
    expect(uvClone).toBeTruthy();
    const fragOutClone = nodes.find((n) => n.type === "fragment_output");
    expect(fragOutClone).toBeTruthy();
    const emissionInput = fragOutClone?.inputs?.find((pin) => pin.id === 3);
    expect(emissionInput?.value).toBe("../10/0");
    const shadingModel = fragOutClone?.properties?.find((prop) => (prop as any)?.id === "shading_model");
    expect((shadingModel as any)?.value).toBe("unlit");
  });

  it("injects builtin UVs for procedural noise nodes", () => {
    const valueNoise: GraphNode = {
      id: 40,
      type: "value_noise",
      name: "Value Noise",
      nodes: [],
      inputs: [
        { id: 0, name: "uv", type: "float2", value: [0, 0] },
        { id: 1, name: "scale", type: "float", value: [500] },
      ],
      outputs: [{ id: 0, name: "out", type: "float" }],
      properties: [],
    } as unknown as GraphNode;

    const probeNode: GraphNode = {
      id: 50,
      type: "editor_probe",
      name: "Probe",
      meta: ["editor_node", "editor_widget:probe"],
      nodes: [],
      inputs: [{ id: 0, name: "input", type: ["float"], value: "../40/0" }],
      outputs: [],
      properties: [],
    } as unknown as GraphNode;

    const fragmentOutput = makeFragmentOutput(60);
    const emissionInput = fragmentOutput.inputs?.find((pin) => pin.id === 3);
    if (emissionInput) emissionInput.value = "../40/0";

    const graph = makeSurfaceGraph([valueNoise, fragmentOutput, probeNode]);

    const result = buildProbeGraph(graph, 50);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;

    const fragmentPass = result.graph.nodes?.[0]?.nodes?.find((n) => n.type === "fragment_pass");
    const nodes = fragmentPass?.nodes ?? [];
    const noiseClone = nodes.find((n) => n.type === "value_noise");
    expect(noiseClone).toBeTruthy();
    const uvInput = noiseClone?.inputs?.find((pin) => pin.id === 0);
    expect(uvInput?.value).toBe("builtin:uv");
  });

  it("handles literal inputs when no connections exist", () => {
    const probeNode: GraphNode = {
      id: 20,
      type: "editor_probe",
      name: "Probe",
      meta: ["editor_node", "editor_widget:probe"],
      nodes: [],
      inputs: [{ id: 0, name: "input", type: ["float"], value: [0.25] }],
      outputs: [],
      properties: [],
    } as unknown as GraphNode;

    const fragmentOutput = makeFragmentOutput(30);
    const graph = makeSurfaceGraph([fragmentOutput, probeNode]);

    const result = buildProbeGraph(graph, 20);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    const fragmentPass = result.graph.nodes?.[0]?.nodes?.find((n) => n.type === "fragment_pass");
    const nodes = fragmentPass?.nodes ?? [];
    expect(nodes.length).toBe(1);
    const fragOutClone = nodes[0];
    const emissionInput = fragOutClone.inputs?.find((pin) => pin.id === 3);
    expect(emissionInput?.value).toEqual([0.25]);
  });

  it("returns idle when the probe lacks an input value", () => {
    const probeNode: GraphNode = {
      id: 20,
      type: "editor_probe",
      name: "Probe",
      meta: ["editor_node", "editor_widget:probe"],
      nodes: [],
      inputs: [{ id: 0, name: "input", type: ["float"], value: undefined }],
      outputs: [],
      properties: [],
    } as unknown as GraphNode;

    const fragmentOutput = makeFragmentOutput(30);
    const graph = makeSurfaceGraph([fragmentOutput, probeNode]);

    const result = buildProbeGraph(graph, 20);
    expect(result.kind).toBe("idle");
    if (result.kind !== "idle") return;
    expect(result.reason).toBe("input-missing");
  });

  it("preserves group containers when dependencies live inside groups", () => {
    const inner: GraphNode = {
      id: 51,
      type: "uv",
      name: "UV",
      nodes: [],
      inputs: [],
      outputs: [{ id: 0, name: "uv", type: "float2" }],
      properties: [],
    } as GraphNode;

    const group: GraphNode = {
      id: 50,
      type: "group",
      name: "Group",
      nodes: [inner],
      inputs: [],
      outputs: [],
      properties: [],
    } as GraphNode;

    const probeNode: GraphNode = {
      id: 20,
      type: "editor_probe",
      name: "Probe",
      meta: ["editor_node", "editor_widget:probe"],
      nodes: [],
      inputs: [{ id: 0, name: "input", type: ["float2"], value: "../51/0" }],
      outputs: [],
      properties: [],
    } as unknown as GraphNode;

    const fragmentOutput = makeFragmentOutput(30);
    const graph = makeSurfaceGraph([group, fragmentOutput, probeNode]);

    const result = buildProbeGraph(graph, 20);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    const fragmentPass = result.graph.nodes?.[0]?.nodes?.find((n) => n.type === "fragment_pass");
    const nodes = fragmentPass?.nodes ?? [];
    const groupClone = nodes.find((n) => n.type === "group");
    expect(groupClone).toBeTruthy();
    expect(groupClone?.nodes?.[0]?.type).toBe("uv");
  });
});
