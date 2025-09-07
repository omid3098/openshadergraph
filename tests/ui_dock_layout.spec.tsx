import { describe, it, expect } from "vitest";
import { buildDockItemDescriptors } from "../src/ui/panels/items";

describe("Dock items builder", () => {
  it("builds items in expected order with all panels", () => {
    const items = buildDockItemDescriptors({ includeEditor: true, includePreview: true, includeCompile: true, includeGraphData: true, includeProperties: true });
    expect(items.map((i) => i.id)).toEqual(["editor", "properties", "compile", "graphdata", "preview"]);
    expect(items.map((i) => i.name)).toEqual(["Editor", "Properties", "Compile", "Graph Data", "Preview"]);
  });

  it("respects include flags", () => {
    const items = buildDockItemDescriptors({ includeEditor: false, includePreview: false, includeCompile: true, includeGraphData: false, includeProperties: false });
    expect(items.map((i) => i.id)).toEqual(["compile"]);
  });
});
