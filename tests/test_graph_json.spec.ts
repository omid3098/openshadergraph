import { describe, it, expect, beforeAll } from "vitest";
import { basic_color_graph, addition_graph, external_graph, vertex_color_graph, meta_graph } from "./graph_samples";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

describe("Graph JSON structure", () => {
  it("basic color graph connections", () => {
    const { fragment_pass, fragment_output, color } = basic_color_graph();
    const childTypes = fragment_pass.nodes.map((n) => n.type);
    expect(childTypes).toContain("color");
    expect(fragment_output.inputs[0].value).toBe(`../${color.id}/0`);
  });

  it("addition graph connections", () => {
    const { fragment_output, color_a, color_b, add_node } = addition_graph();
    expect(add_node.inputs[0].value).toBe(`../${color_a.id}/0`);
    expect(add_node.inputs[1].value).toBe(`../${color_b.id}/0`);
    expect(fragment_output.inputs[0].value).toBe(`../${add_node.id}/0`);
  });

  it("external graph import", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "osg-"));
    const { surface, initial_count } = external_graph(dir);
    expect(surface.graph_data.nodes.length).toBe(initial_count + 1);
    expect(surface.graph_data.nodes.at(-1)?.type).toBe("color");
  });

  it("nested vertex graph lookup", () => {
    const { surface, vertex_pass, color } = vertex_color_graph();
    const nested = surface.find_nested_node_by_type(vertex_pass, "color");
    expect(nested).toBeDefined();
    expect(nested!.id).toBe(color.id);
  });

  it("node meta stored on graph", () => {
    const { surface } = meta_graph();
    expect(surface.graph_data.meta).toEqual(["blend_mode_transparent"]);
  });
});

