import { describe, it, expect } from "vitest";
import { prepareVisibleNodes } from "../src/core/ui/visible";

type N = { id: string; parentId?: string; data?: any; position?: any };

describe("prepareVisibleNodes", () => {
  it("filters by current parent and strips missing parentId", () => {
    const parent: N = { id: "10" };
    const childA: N = { id: "11", parentId: "10" };
    const childB: N = { id: "12", parentId: "10" };
    const nodes = [parent, childA, childB];
    const visible = prepareVisibleNodes(nodes, "10");
    // parent is not shown in this view; children are visible without parentId
    expect(visible.length).toBe(2);
    for (const n of visible) {
      expect(n.parentId).toBeUndefined();
    }
  });

  it("shows only root nodes at top-level", () => {
    const parent: N = { id: "1" };
    const child: N = { id: "2", parentId: "1" };
    const nodes = [parent, child];
    const visible = prepareVisibleNodes(nodes, undefined);
    expect(visible.map((n) => n.id)).toEqual(["1"]);
  });
});

