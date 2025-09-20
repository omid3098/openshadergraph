import { describe, it, expect } from "vitest";
import { NodeBuilder } from "../src/core/graph/node";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import { loadLanguage } from "../src/core/schema/registry";

async function compile(langFile: string, root: any) {
  const lang = await loadLanguage(langFile);
  const compiler = new GraphCompiler(root, lang);
  compiler.compile();
  return compiler.result_code;
}

describe("Separate/Combine nodes", () => {
  it("separate3 exposes x,y,z channels (Godot)", async () => {
    const surface = new NodeBuilder("surface");
    const fp = surface.get_node_by_type("fragment_pass")!;
    const in3 = surface.create_node("float3", fp);
    (in3.inputs[0] as any).value = [0.1, 0.2, 0.3];
    const sep = surface.create_node("separate3", fp);
    const out = surface.find_nested_node_by_type(fp, "fragment_output")!;
    surface.connect_nodes(in3, sep, 0, 0);
    surface.connect_nodes(sep, out, 0, 1); // x -> Roughness
    surface.connect_nodes(sep, out, 1, 2); // y -> Metallic
    const code = await compile("Godot.json", surface.to_dict());
    expect(code).toMatch(/vec3 separate3_\d+ = float3_\d+;/);
    expect(code).toMatch(/ROUGHNESS\s*=\s*separate3_\d+\.x;/);
    expect(code).toMatch(/METALLIC\s*=\s*separate3_\d+\.y;/);
  });

  it("combine3 constructs vec3 from three scalars (Godot)", async () => {
    const surface = new NodeBuilder("surface");
    const fp = surface.get_node_by_type("fragment_pass")!;
    const fx = surface.create_node("float", fp);
    const fy = surface.create_node("float", fp);
    const fz = surface.create_node("float", fp);
    (fx.inputs[0] as any).value = [0.1];
    (fy.inputs[0] as any).value = [0.2];
    (fz.inputs[0] as any).value = [0.3];
    const cmb = surface.create_node("combine3", fp);
    const out = surface.find_nested_node_by_type(fp, "fragment_output")!;
    surface.connect_nodes(fx, cmb, 0, 0);
    surface.connect_nodes(fy, cmb, 0, 1);
    surface.connect_nodes(fz, cmb, 0, 2);
    surface.connect_nodes(cmb, out, 0, 3); // Emission
    const code = await compile("Godot.json", surface.to_dict());
    expect(code).toMatch(/vec3 combine3_\d+ = vec3\(float_\d+, float_\d+, float_\d+\);/);
    expect(code).toMatch(/EMISSION\s*=\s*vec3\(combine3_\d+\)(?:\s*\*\s*[^\n;]+)?;/);
  });

  it("separate4 and combine4 work in ThreeJS", async () => {
    const surface = new NodeBuilder("surface");
    const fp = surface.get_node_by_type("fragment_pass")!;
    const v4 = surface.create_node("float4", fp);
    (v4.inputs[0] as any).value = [0.1, 0.2, 0.3, 0.4];
    const sep4 = surface.create_node("separate4", fp);
    const fx = surface.create_node("float", fp);
    const fy = surface.create_node("float", fp);
    const fz = surface.create_node("float", fp);
    const fw = surface.create_node("float", fp);
    (fx.inputs[0] as any).value = [0.5];
    (fy.inputs[0] as any).value = [0.6];
    (fz.inputs[0] as any).value = [0.7];
    (fw.inputs[0] as any).value = [0.8];
    const cmb4 = surface.create_node("combine4", fp);
    const out = surface.find_nested_node_by_type(fp, "fragment_output")!;
    surface.connect_nodes(v4, sep4, 0, 0);
    surface.connect_nodes(sep4, out, 0, 1); // x -> Roughness
    surface.connect_nodes(sep4, out, 3, 5); // w -> Alpha
    surface.connect_nodes(fx, cmb4, 0, 0);
    surface.connect_nodes(fy, cmb4, 0, 1);
    surface.connect_nodes(fz, cmb4, 0, 2);
    surface.connect_nodes(fw, cmb4, 0, 3);
    surface.connect_nodes(cmb4, out, 0, 0); // Albedo from vec4.rgb
    const code = await compile("ThreeJS_GLSL.json", surface.to_dict());
    expect(code).toMatch(/vec4 separate4_\d+ = float4_\d+;/);
    expect(code).toMatch(/vec4 combine4_\d+ = vec4\(float_\d+, float_\d+, float_\d+, float_\d+\);/);
    // threejs fragment format uses baseColor = vec3({{inputs:0}})
    // Accept either direct value or implicit downcast via .rgb
    expect(code).toMatch(/baseColor\s*=\s*vec3\(combine4_\d+(\.rgb)?\)/);
  });
});


