import { describe, expect, it, vi } from "vitest";
import type { Node } from "@xyflow/react";
import { attachNodeUpdateApi, attachNodesUpdateApi, type NodeUpdaterApi } from "../nodeUpdaters";

const makeApi = (): NodeUpdaterApi => ({
  updateInputValue: vi.fn(),
  updatePropertyValue: vi.fn(),
  updateNodeLabel: vi.fn(),
  addNodeMeta: vi.fn(),
  removeNodeMeta: vi.fn(),
});

describe("nodeUpdaters", () => {
  it("attaches update callbacks without mutating the original node", () => {
    const api = makeApi();
    const original: Node = {
      id: "1",
      type: "graphNode",
      position: { x: 0, y: 0 },
      data: { label: "Base" },
    } as any;

    const result = attachNodeUpdateApi(original, api);

    expect(result).not.toBe(original);
    expect(result.data).not.toBe(original.data);
    expect((result.data as any).label).toBe("Base");
    expect((result.data as any).updateNodeLabel).toBe(api.updateNodeLabel);
    expect((original.data as any).updateNodeLabel).toBeUndefined();
  });

  it("overrides any existing callback references", () => {
    const api = makeApi();
    const staleApi = makeApi();
    const original: Node = {
      id: "2",
      type: "graphNode",
      position: { x: 0, y: 0 },
      data: { updateNodeLabel: staleApi.updateNodeLabel },
    } as any;

    const result = attachNodeUpdateApi(original, api);

    expect((result.data as any).updateNodeLabel).toBe(api.updateNodeLabel);
  });

  it("attaches callbacks to every node in the list", () => {
    const api = makeApi();
    const nodes: Node[] = [
      { id: "a", type: "graphNode", position: { x: 0, y: 0 }, data: {} },
      { id: "b", type: "graphNode", position: { x: 1, y: 1 }, data: { label: "B" } },
    ] as any;

    const result = attachNodesUpdateApi(nodes, api);

    expect(result).toHaveLength(2);
    for (const node of result) {
      expect((node.data as any).updateInputValue).toBe(api.updateInputValue);
      expect((node.data as any).updatePropertyValue).toBe(api.updatePropertyValue);
      expect((node.data as any).updateNodeLabel).toBe(api.updateNodeLabel);
      expect((node.data as any).addNodeMeta).toBe(api.addNodeMeta);
      expect((node.data as any).removeNodeMeta).toBe(api.removeNodeMeta);
    }
  });
});
