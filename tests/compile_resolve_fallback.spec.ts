import { describe, it, expect } from "vitest";
import { NodeBuilder } from "../src/core/graph/node";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import { loadLanguage } from "../src/core/schema/registry";

describe("compiler resolves refs even if source node misplaced", () => {
  it("compiles when a referenced node sits at root instead of pass", async () => {
    // Build a simple surface with fragment pass, color -> fragment_output
    const surface = new NodeBuilder("surface");
    const fragment_pass = surface.get_node_by_type("fragment_pass")!;
    const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
    const color = surface.create_node("color", fragment_pass);
    surface.connect_nodes(color, fragment_output, 0, 0);

    const g = surface.to_dict();
    // Simulate a mis-parenting bug: remove the color from pass and put at root
    fragment_pass.nodes = fragment_pass.nodes.filter((n: any) => n.id !== color.id);
    g.nodes.push(color);

    // Compile ThreeJS GLSL
    const lang = await loadLanguage("ThreeJS_GLSL.json");
    const compiler = new GraphCompiler(g, lang);
    compiler.compile();
    const code = compiler.result_code;
    expect(code).toMatch(/precision highp float;/);
    // Color declaration present somewhere
    expect(code).toMatch(/vec4 color_\d+ = vec4\(/);
    // main() writes from that color
    expect(code).toMatch(/gl_FragColor\s*=\s*vec4\(color,\s*outAlpha\);/);
  });
});

