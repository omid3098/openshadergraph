import { describe, it, expect } from "vitest";
import { buildRFNodeFromTemplate } from "../src/core/ui/nodeFactory";

const nodeDefaults = {
  sourcePosition: "right",
  targetPosition: "left",
} as any;

describe("UI add node behavior", () => {
  it("adds new node under current parent (visible in nested view)", () => {
    const parentId = "42"; // e.g., fragment_pass id in view
    const item = { type: "color", name: "Color", path: "constants/color.json", category: "constants" } as any;
    const n = buildRFNodeFromTemplate({
      id: "99",
      item,
      position: { x: 100, y: 200 },
      parentId,
      nodeDefaults,
    });
    expect((n as any).parentId).toBe(parentId);
    expect(n.data).toBeDefined();
    expect((n.data as any).type).toBe("color");
  });

  it("adds new root-level node when not in nested view", () => {
    const item = { type: "float", name: "Float", path: "math/float.json", category: "math" } as any;
    const n = buildRFNodeFromTemplate({
      id: "7",
      item,
      position: { x: 10, y: 20 },
      nodeDefaults,
    });
    expect((n as any).parentId).toBeUndefined();
    expect((n.data as any).type).toBe("float");
  });
});

