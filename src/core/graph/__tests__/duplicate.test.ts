import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { duplicateNodes } from "../duplicate";

type PinConfig = {
  id?: number;
  name?: string;
  type?: string;
  value?: unknown;
};

type NodeConfig = {
  label?: string;
  type?: string;
  position?: { x: number; y: number };
  inputs?: PinConfig[];
  outputs?: PinConfig[];
  parentId?: string;
};

function createPin(config: PinConfig, index: number): any {
  return {
    id: config.id ?? index,
    name: config.name ?? `pin${index}`,
    type: config.type ?? "float",
    ...(config.value !== undefined ? { value: config.value } : {}),
  };
}

function createNode(id: number, config: NodeConfig = {}): Node {
  const position = config.position ?? { x: 0, y: 0 };
  const inputs = (config.inputs ?? []).map((pin, index) => createPin(pin, index));
  const outputs = (config.outputs ?? []).map((pin, index) => createPin(pin, index));
  const template = {
    id,
    type: config.type ?? "test",
    name: config.label ?? `Node ${id}`,
    position: [position.x, position.y],
    nodes: [] as any[],
    inputs,
    outputs,
    properties: [] as any[],
    meta: [] as any[],
  };
  const templateDefaults = {
    ...template,
    inputs: inputs.map((pin) => ({ ...pin })),
    outputs: outputs.map((pin) => ({ ...pin })),
  };
  const node: Node = {
    id: String(id),
    type: "graphNode",
    position,
    data: {
      label: config.label ?? `Node ${id}`,
      type: config.type ?? "test",
      template,
      templateDefaults,
    },
  } as Node;
  if (config.parentId) (node as any).parentId = config.parentId;
  return node;
}

function createEdge(id: string, source: string, target: string, sourceHandle = "out-0", targetHandle = "in-0"): Edge {
  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    data: { sourceType: "float", targetType: "float" },
  } as Edge;
}

describe("duplicateNodes", () => {
  it("duplicates a single node and assigns a fresh id", () => {
    const nodes = [createNode(1, { position: { x: 10, y: 20 }, outputs: [{ id: 0, name: "out" }] })];
    const edges: Edge[] = [];
    const selectedIds = new Set(["1"]);
    let cursor = 1;
    const result = duplicateNodes({
      nodes,
      edges,
      selectedIds,
      allocateId: () => ++cursor,
    });

    expect(result.nodesToAdd).toHaveLength(1);
    const cloned = result.nodesToAdd[0];
    expect(cloned.id).toBe("2");
    expect((cloned.data as any).template.id).toBe(2);
    expect((cloned.data as any).template.position).toEqual([10, 20]);
    expect(result.edgesToAdd).toHaveLength(0);
    expect(result.selection).toEqual(["2"]);
    expect((nodes[0].data as any).template.id).toBe(1);
    expect((nodes[0].data as any).template).not.toBe((cloned.data as any).template);
  });

  it("duplicates connected nodes and rewires edges", () => {
    const nodeA = createNode(1, { outputs: [{ id: 0, name: "out" }], position: { x: 0, y: 0 } });
    const nodeB = createNode(2, {
      inputs: [{ id: 0, name: "in", value: "../1/0" }],
      position: { x: 120, y: 0 },
    });
    const nodes = [nodeA, nodeB];
    const edges = [createEdge("e1", "1", "2")];
    const selectedIds = new Set(["1", "2"]);
    let cursor = 2;
    const result = duplicateNodes({
      nodes,
      edges,
      selectedIds,
      allocateId: () => ++cursor,
    });

    expect(result.nodesToAdd).toHaveLength(2);
    const [dupA, dupB] = result.nodesToAdd;
    expect(dupA.id).toBe("3");
    expect(dupB.id).toBe("4");
    const dupEdge = result.edgesToAdd[0];
    expect(dupEdge.source).toBe("3");
    expect(dupEdge.target).toBe("4");
    const dupBInput = ((dupB.data as any).template.inputs as any[])[0];
    expect(dupBInput.value).toBe("../3/0");
    const dupAOutput = ((dupA.data as any).template.outputs as any[])[0];
    expect(dupAOutput.value).toBe("../4/0");
    const originalInput = ((nodeB.data as any).template.inputs as any[])[0];
    expect(originalInput.value).toBe("../1/0");
  });

  it("maps children to duplicate parent when both are selected", () => {
    const parent = createNode(10, { position: { x: 40, y: 40 } });
    const child = createNode(11, { position: { x: 12, y: 8 }, parentId: "10" });
    const nodes = [parent, child];
    const edges: Edge[] = [];
    const selectedIds = new Set(["10", "11"]);
    let cursor = 11;
    const result = duplicateNodes({
      nodes,
      edges,
      selectedIds,
      allocateId: () => ++cursor,
    });

    expect(result.nodesToAdd).toHaveLength(2);
    const dupParent = result.nodesToAdd.find((node) => node.id === "12");
    expect(dupParent).toBeDefined();
    const dupChild = result.nodesToAdd.find((node) => node.id === "13");
    expect(dupChild).toBeDefined();
    expect((dupChild as any)?.parentId).toBe("12");
    expect((child as any).parentId).toBe("10");
  });

  it("retains original parent when parent is not duplicated", () => {
    const parent = createNode(20);
    const child = createNode(21, { parentId: "20", position: { x: 5, y: 5 } });
    const nodes = [parent, child];
    const edges: Edge[] = [];
    const selectedIds = new Set(["21"]);
    let cursor = 21;
    const result = duplicateNodes({
      nodes,
      edges,
      selectedIds,
      allocateId: () => ++cursor,
    });

    expect(result.nodesToAdd).toHaveLength(1);
    const dupChild = result.nodesToAdd[0];
    expect((dupChild as any).parentId).toBe("20");
    expect(((dupChild.data as any).template.position)).toEqual([5, 5]);
  });

  it("clears connections to nodes outside the selection", () => {
    const source = createNode(30, { outputs: [{ id: 0, name: "out" }] });
    const target = createNode(31, { inputs: [{ id: 0, name: "in", value: "../30/0" }] });
    const nodes = [source, target];
    const edges = [createEdge("e2", "30", "31")];
    const selectedIds = new Set(["31"]);
    let cursor = 31;
    const result = duplicateNodes({
      nodes,
      edges,
      selectedIds,
      allocateId: () => ++cursor,
    });

    expect(result.edgesToAdd).toHaveLength(0);
    const dupTarget = result.nodesToAdd[0];
    const dupInput = ((dupTarget.data as any).template.inputs as any[])[0];
    expect(dupInput.value).toBeUndefined();
    const originalInput = ((target.data as any).template.inputs as any[])[0];
    expect(originalInput.value).toBe("../30/0");
  });
});

