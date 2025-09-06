import { describe, it, expect } from "vitest";
import { buildDockItemDescriptors } from "../src/ui/panels/items";

describe("Dock items builder", () => {
  it("builds items in expected order with all panels", () => {
    const items = buildDockItemDescriptors({ includePreview: true, includeCompile: true, includeGraphData: true, includeProperties: true });
    expect(items.map((i) => i.id)).toEqual(["properties", "compile", "graphdata"]);
    expect(items.map((i) => i.name)).toEqual(["Properties", "Compile", "Graph Data"]);
  });

  it("respects include flags", () => {
    const items = buildDockItemDescriptors({ includePreview: false, includeCompile: true, includeGraphData: false, includeProperties: false });
    expect(items.map((i) => i.id)).toEqual(["compile"]);
  });
});
