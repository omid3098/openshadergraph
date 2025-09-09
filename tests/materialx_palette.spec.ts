import { describe, it, expect } from "vitest";
import { getNodePalette, getNodeTemplate } from "../src/core/schema/registry";
import { graphToMaterialX } from "../src/core/io/materialx";

describe("MaterialX integration", () => {
  it("loads node palette from MaterialX stdlib", () => {
    const palette = getNodePalette();
    expect(palette.flat.length).toBeGreaterThan(0);
    const add = palette.flat.find((n) => n.type === "ND_add_float");
    expect(add).toBeTruthy();
    expect(add?.category).toBe("math");
    const tmpl = getNodeTemplate("ND_add_float");
    expect(tmpl?.inputs?.length).toBeGreaterThan(0);
  });

  it("serializes graph to MaterialX XML", () => {
    const graph = {
      name: "Test",
      nodes: [
        {
          id: 1,
          type: "constant",
          name: "const1",
          inputs: [],
          outputs: [{ id: 0, name: "out", type: "float" }],
        },
        {
          id: 2,
          type: "add",
          name: "add1",
          inputs: [{ id: 0, name: "a", type: "float", value: "../1/0" }],
          outputs: [],
        },
      ],
    };
    const xml = graphToMaterialX(graph);
    expect(xml).toContain('<nodegraph name="Test">');
    expect(xml).toContain('<node name="const1" type="constant">');
    expect(xml).toContain('<input name="a" type="float" node="const1" output="out" />');
  });
});
