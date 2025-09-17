import { describe, it, expect } from "vitest";

type Node = {
  id: string;
  parentId?: string;
  data: any;
};

function updateNodeInputValue(setNodes: (updater: (prev: Node[]) => Node[]) => void) {
  return (id: string, pinId: number, next: number[] | string | number) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const tpl = n.data?.template;
        if (!tpl || !Array.isArray(tpl.inputs)) return n as any;
        const idx = tpl.inputs.findIndex((p: any, i: number) => (typeof p.id === "number" ? p.id === pinId : i === pinId));
        if (idx < 0) return n as any;
        const normalized = Array.isArray(next) ? next : typeof next === "number" ? [next] : next;
        const nextTpl = { ...tpl, inputs: tpl.inputs.map((p: any, i: number) => (i === idx ? { ...p, value: normalized } : p)) };
        return { ...n, data: { ...(n.data as any), template: nextTpl } } as any;
      })
    );
  };
}

describe("update input preserves parentId", () => {
  it("does not drop parentId when editing a nested node", () => {
    let state: Node[] = [
      { id: "0", data: { type: "surface", template: { type: "surface", inputs: [], outputs: [], nodes: [], properties: [] } } },
      { id: "2", parentId: "0", data: { type: "fragment_pass", template: { type: "fragment_pass", inputs: [], outputs: [], nodes: [], properties: [] } } },
      { id: "4", parentId: "2", data: { type: "color", template: { type: "color", inputs: [{ id: 0, name: "in", type: "float4", value: [1, 1, 1, 1] }], outputs: [{ id: 0, name: "out", type: "float4" }], properties: [] } } },
    ];
    const setNodes = (updater: (prev: Node[]) => Node[]) => {
      state = updater(state);
    };
    const update = updateNodeInputValue(setNodes);
    update("4", 0, [1, 0, 0, 1]);
    const color = state.find((n) => n.id === "4")!;
    expect(color.parentId).toBe("2");
    expect(color.data?.template?.inputs?.[0]?.value).toEqual([1, 0, 0, 1]);
  });
});
