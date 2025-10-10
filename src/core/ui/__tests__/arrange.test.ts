// @ts-nocheck
import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import { alignSelectedNodes, distributeSelectedNodes, type AlignmentKind, type DistributionKind } from "../arrange";

type TestNode = Node<{ label?: string }> & {
  width?: number;
  height?: number;
  parentId?: string;
};

function makeNode(id: string, position: { x: number; y: number }, options: {
  width?: number;
  height?: number;
  parentId?: string;
  positionAbsolute?: { x: number; y: number };
} = {}): TestNode {
  const base: TestNode = {
    id,
    type: "test",
    data: { label: id },
    position,
    width: options.width,
    height: options.height,
  };
  if (options.parentId) base.parentId = options.parentId;
  if (options.positionAbsolute) base.positionAbsolute = options.positionAbsolute as any;
  return base;
}

describe("alignSelectedNodes", () => {
  it("aligns selected nodes to the left edge", () => {
    const nodes = [
      makeNode("1", { x: 40, y: 10 }, { width: 120, height: 60 }),
      makeNode("2", { x: 80, y: 40 }, { width: 80, height: 40 }),
      makeNode("3", { x: 160, y: 90 }, { width: 60, height: 30 }),
    ];
    const selection = new Set(["1", "2", "3"]);
    const { nodes: aligned, changed } = alignSelectedNodes(nodes, selection, "left");
    expect(changed).toBe(true);
    expect(aligned[0].position.x).toBe(40);
    expect(aligned[1].position.x).toBe(40);
    expect(aligned[2].position.x).toBe(40);
  });

  it("aligns centers while respecting node widths", () => {
    const nodes = [
      makeNode("a", { x: 0, y: 0 }, { width: 100, height: 40 }),
      makeNode("b", { x: 200, y: 20 }, { width: 60, height: 40 }),
    ];
    const selection = new Set(["a", "b"]);
    const { nodes: aligned, changed } = alignSelectedNodes(nodes, selection, "center");
    expect(changed).toBe(true);
    const centerX = (aligned[0].position.x + (aligned[0].width ?? 0) / 2);
    const centerXB = (aligned[1].position.x + (aligned[1].width ?? 0) / 2);
    expect(centerX).toBeCloseTo(centerXB, 4);
  });

  it("keeps groups with different parents independent", () => {
    const nodes = [
      makeNode("p1", { x: 0, y: 0 }, { width: 0, height: 0 }),
      makeNode("c1", { x: 20, y: 20 }, { width: 40, height: 40, parentId: "p1" }),
      makeNode("c2", { x: 60, y: 40 }, { width: 40, height: 40, parentId: "p1" }),
      makeNode("c3", { x: 0, y: 100 }, { width: 40, height: 40 }),
      makeNode("c4", { x: 40, y: 140 }, { width: 40, height: 40 }),
    ];
    const selection = new Set(["c1", "c2", "c3", "c4"]);
    const { nodes: aligned } = alignSelectedNodes(nodes, selection, "top");
    expect(aligned.find((n) => n.id === "c1")?.position.y).toBe(20);
    expect(aligned.find((n) => n.id === "c2")?.position.y).toBe(20);
    expect(aligned.find((n) => n.id === "c3")?.position.y).toBe(100);
    expect(aligned.find((n) => n.id === "c4")?.position.y).toBe(100);
  });

  it("updates absolute positions when present", () => {
    const nodes = [
      makeNode("one", { x: 10, y: 10 }, { width: 50, height: 20, positionAbsolute: { x: 210, y: 310 } }),
      makeNode("two", { x: 70, y: 40 }, { width: 30, height: 20, positionAbsolute: { x: 270, y: 340 } }),
    ];
    const selection = new Set(["one", "two"]);
    const { nodes: aligned } = alignSelectedNodes(nodes, selection, "left");
    const first = aligned.find((n) => n.id === "one")!;
    const second = aligned.find((n) => n.id === "two")!;
    expect(first.positionAbsolute?.x).toBeCloseTo(first.position.x + 200, 4);
    expect(second.positionAbsolute?.x).toBeCloseTo(second.position.x + 200, 4);
  });

  it("aligns nodes that have no width set (mimicking raw ReactFlow nodes)", () => {
    const nodes = [
      makeNode("p", { x: -120, y: 0 }),
      makeNode("q", { x: 80, y: 40 }),
      makeNode("r", { x: 200, y: -20 }),
    ];
    const selection = new Set(["p", "q", "r"]);
    const { nodes: aligned, changed } = alignSelectedNodes(nodes, selection, "left");
    expect(changed).toBe(true);
    const smallest = Math.min(...nodes.map((n) => n.position.x));
    expect(aligned.filter((n) => selection.has(n.id)).every((n) => n.position.x === smallest)).toBe(true);
    expect(aligned.find((n) => n.id === "p")?.position.y).toBe(nodes[0].position.y);
  });
});

describe("distributeSelectedNodes", () => {
  it("distributes nodes horizontally keeping outer nodes anchored", () => {
    const nodes = [
      makeNode("1", { x: 0, y: 0 }, { width: 50, height: 50 }),
      makeNode("2", { x: 120, y: 10 }, { width: 50, height: 50 }),
      makeNode("3", { x: 300, y: 20 }, { width: 50, height: 50 }),
    ];
    const selection = new Set(["1", "2", "3"]);
    const { nodes: distributed, changed } = distributeSelectedNodes(nodes, selection, "horizontal");
    expect(changed).toBe(true);
    const first = distributed[0];
    const middle = distributed[1];
    const last = distributed[2];
    expect(first.position.x).toBe(0);
    expect(last.position.x).toBeCloseTo(300, 4);
    expect(middle.position.x - first.position.x - (first.width ?? 0)).toBeCloseTo(last.position.x - middle.position.x - (middle.width ?? 0), 4);
  });

  it("distributes nodes vertically within their parent", () => {
    const nodes = [
      makeNode("p", { x: 0, y: 0 }, { width: 0, height: 0 }),
      makeNode("a", { x: 10, y: 10 }, { width: 40, height: 20, parentId: "p" }),
      makeNode("b", { x: 10, y: 80 }, { width: 40, height: 20, parentId: "p" }),
      makeNode("c", { x: 10, y: 140 }, { width: 40, height: 20, parentId: "p" }),
    ];
    const selection = new Set(["a", "b", "c"]);
    const { nodes: distributed } = distributeSelectedNodes(nodes, selection, "vertical");
    const a = distributed.find((n) => n.id === "a")!;
    const b = distributed.find((n) => n.id === "b")!;
    const c = distributed.find((n) => n.id === "c")!;
    expect(a.position.y).toBe(10);
    expect(c.position.y).toBeCloseTo(140, 4);
    const firstGap = b.position.y - a.position.y - (a.height ?? 0);
    const secondGap = c.position.y - b.position.y - (b.height ?? 0);
    expect(firstGap).toBeCloseTo(secondGap, 4);
  });

  it("stacks nodes vertically with a 1px gap", () => {
    const nodes = [
      makeNode("a", { x: 0, y: 50 }, { width: 40, height: 20 }),
      makeNode("b", { x: 40, y: 10 }, { width: 40, height: 60 }),
      makeNode("c", { x: -10, y: 90 }, { width: 40, height: 30 }),
    ];
    const selection = new Set(["a", "b", "c"]);
    const { nodes: stacked } = distributeSelectedNodes(nodes, selection, "vertical-stack");
    const a = stacked.find((n) => n.id === "a")!;
    const b = stacked.find((n) => n.id === "b")!;
    const c = stacked.find((n) => n.id === "c")!;
    expect(b.position.y).toBeCloseTo(10, 4);
    expect(a.position.y).toBeCloseTo((b.position.y + (b.height ?? 0) + 1), 4);
    expect(c.position.y).toBeCloseTo((a.position.y + (a.height ?? 0) + 1), 4);
    expect(a.position.x).toBe(0);
    expect(b.position.x).toBe(40);
    expect(c.position.x).toBe(-10);
  });

  it("does nothing when fewer than three nodes are selected", () => {
    const nodes = [
      makeNode("1", { x: 0, y: 0 }, { width: 50, height: 50 }),
      makeNode("2", { x: 100, y: 0 }, { width: 50, height: 50 }),
    ];
    const selection = new Set(["1", "2"]);
    const result = distributeSelectedNodes(nodes, selection, "horizontal");
    expect(result.changed).toBe(false);
    expect(result.nodes).toBe(nodes);
  });

  it("distributes nodes with zero widths similar to measured ReactFlow nodes", () => {
    const nodes = [
      makeNode("p", { x: 10, y: 0 }),
      makeNode("q", { x: 30, y: 10 }),
      makeNode("r", { x: 50, y: 20 }),
      makeNode("s", { x: 70, y: 30 }),
    ];
    const selection = new Set(["p", "q", "r", "s"]);
    const { nodes: distributed, changed } = distributeSelectedNodes(nodes, selection, "horizontal");
    expect(changed).toBe(true);
    const picked = distributed.filter((n) => selection.has(n.id));
    const deltas = [picked[1].position.x - picked[0].position.x, picked[2].position.x - picked[1].position.x, picked[3].position.x - picked[2].position.x];
    expect(deltas[0]).toBeCloseTo(deltas[1], 4);
    expect(deltas[1]).toBeCloseTo(deltas[2], 4);
  });
});

describe("arrange selections end-to-end", () => {
  function alignViaUi(nodes: Node[], selectedIds: string[], alignment: AlignmentKind) {
    const selection = new Set(selectedIds);
    const { nodes: aligned, changed } = alignSelectedNodes(nodes, selection, alignment);
    return changed ? aligned : nodes;
  }

  function distributeViaUi(nodes: Node[], selectedIds: string[], distribution: DistributionKind) {
    const selection = new Set(selectedIds);
    const { nodes: distributed, changed } = distributeSelectedNodes(nodes, selection, distribution);
    return changed ? distributed : nodes;
  }

  it("aligns then distributes just like the UI callback chain", () => {
    const base = [
      makeNode("1", { x: 5, y: 5 }, { width: 0 }),
      makeNode("2", { x: 135, y: 25 }, { width: 0 }),
      makeNode("3", { x: 260, y: 55 }, { width: 0 }),
      makeNode("4", { x: 390, y: 15 }, { width: 0 }),
    ];
    const selected = ["1", "2", "3", "4"];

    const aligned = alignViaUi(base, selected, "top");
    expect(aligned.filter((n) => selected.includes(n.id)).every((n) => n.position.y === 5)).toBe(true);

    const distributed = distributeViaUi(aligned, selected, "horizontal");
    const xs = distributed.filter((n) => selected.includes(n.id)).map((n) => n.position.x);
    const spaces = [xs[1] - xs[0], xs[2] - xs[1], xs[3] - xs[2]];
    expect(spaces[0]).toBeCloseTo(spaces[1], 4);
    expect(spaces[1]).toBeCloseTo(spaces[2], 4);
  });
});
