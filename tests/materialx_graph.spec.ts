import { describe, it, expect } from "vitest";
import { NodeBuilder } from "../src/core/graph/node";
import { getDataTypes, loadLanguage } from "../src/core/schema/registry";

describe("MaterialX graph", () => {
  it("creates and connects MaterialX nodes", () => {
    const builder = new NodeBuilder("ND_add_float");
    const add = builder.graph_data;
    expect(add.type).toBe("ND_add_float");
    expect(add.inputs?.length).toBeGreaterThan(0);
    const mul = builder.create_node("ND_multiply_float");
    builder.connect_nodes(add, mul, 0, 0);
    expect(mul.inputs?.[0].value).toBe(`../${add.id}/0`);
  });

  it("includes datatypes from MaterialX", () => {
    const types = getDataTypes();
    expect(types).toContain("color3");
  });

  it("creates group with io nodes", () => {
    const builder = new NodeBuilder("group");
    const childTypes = builder.graph_data.nodes?.map((n) => n.type);
    expect(childTypes).toEqual(["group_input", "group_output"]);
  });

  it("loads language pack", async () => {
    const lang = await loadLanguage("ThreeJS_GLSL");
    expect(lang.name).toBe("ThreeJS GLSL");
  });
});
