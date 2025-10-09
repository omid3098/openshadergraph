import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs, rmSync } from "fs";
import path from "path";
import { basic_color_graph, addition_graph, vector_scalar_addition_graph, float_graph, meta_graph, external_graph, vertex_color_graph, exposed_addition_graph, full_fragment_graph, texture_sampling_graph, vector_wave_graph, texture_sampler_default_uv_graph, texture_sampler_channels_graph, dot_normalize_view_graph, transform_graph, logic_fresnel_graph, cubemap_sampling_graph } from "./graph_samples";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import { loadLanguage } from "../src/core/schema/registry";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";

const ROOT = process.cwd();
const SHADERS_DIR = path.join(ROOT, "tests", "shaders");
const ENGINE_DIR = path.join(SHADERS_DIR, "godot");

async function compile_graph(graph: any, languageFile: string, name = "shader") {
  const lang = await loadLanguage(languageFile.endsWith(".json") ? languageFile : `${languageFile}`);
  const compiler = new GraphCompiler(graph, lang);
  compiler.compile();
  const ext = lang.file_extensions[0];
  const engine = path.parse(languageFile).name.toLowerCase();
  const out_dir = path.join(SHADERS_DIR, engine);
  await fs.mkdir(out_dir, { recursive: true });
  const out_file = path.join(out_dir, `${name}.${ext}`);
  await fs.writeFile(out_file, compiler.result_code, "utf8");
  return compiler.result_code;
}

describe("Godot shader generation", () => {
  beforeAll(() => {
    rmSync(ENGINE_DIR, { recursive: true, force: true });
  });

  it("basic color shader", async () => {
    const { surface } = basic_color_graph();
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "basic_color");
    expect(shader_code).toMatch(/shader_type spatial;/);
    expect(shader_code).toMatch(/vec4 color_\d+ = vec4\(1.0, 1.0, 1.0, 1.0\);/);
    expect(shader_code).toMatch(/ALBEDO = vec3\(color_\d+\.rgb\);/);
    expect(shader_code).toMatch(/ROUGHNESS\s*=\s*0\.5\s*;/);
    expect(shader_code).toMatch(/METALLIC\s*=\s*0\.0\s*;/);
    expect(shader_code).toMatch(/EMISSION\s*=\s*vec3\(0\.0,\s*0\.0,\s*0\.0\)\s*\*\s*1\.0\s*;/);
    expect(shader_code).toMatch(/NORMAL\s*=\s*vec3\(NORMAL\)\s*;/);
    expect(shader_code).toMatch(/ALPHA\s*=\s*1\.0\s*;/);
    expect(shader_code).toMatch(/SPECULAR\s*=\s*0\.5\s*;/);
    expect(shader_code).toMatch(/AO\s*=\s*1\.0\s*;/);
    expect(shader_code).toMatch(/AO_LIGHT_AFFECT\s*=\s*0\.0\s*;/);
    expect(shader_code).toMatch(/void vertex\(\) \{[^}]*NORMAL\s*=\s*vec3\(NORMAL\)\s*;/);
    expect(shader_code).toMatch(/void vertex\(\) \{[^}]*COLOR\s*=\s*vec4\(COLOR\)\s*;/);
    expect(shader_code).not.toMatch(/CLEARCOAT\s*=\s*0\.0\s*;/);
    expect(shader_code).not.toMatch(/CLEARCOAT_ROUGHNESS\s*=\s*0\.5\s*;/);
    expect(shader_code).not.toMatch(/SSS_STRENGTH\s*=\s*0\.0\s*;/);
    expect(shader_code).not.toMatch(/SSS_TRANSMITTANCE_COLOR\s*=\s*vec4/);
    expect(shader_code).not.toMatch(/ANISOTROPY\s*=\s*0\.0\s*;/);
    expect(shader_code).not.toMatch(/ANISOTROPY_FLOW\s*=\s*vec3/);
    // No duplicates: one vertex(), one fragment(), one ALBEDO assignment, one color var decl
    const count = (re: RegExp) => (shader_code.match(re) ?? []).length;
    expect(count(/^void vertex\(\)/gm)).toBe(1);
    expect(count(/^void fragment\(\)/gm)).toBe(1);
    expect(count(/\bALBEDO\s*=/g)).toBe(1);
    expect(count(/\bvec4\s+color_\d+\s*=\s*vec4\(/g)).toBe(1);
    // No leading tab before top-level function definitions
    expect(shader_code).not.toMatch(/^\tvoid vertex\(\)/m);
    expect(shader_code).not.toMatch(/^\tvoid fragment\(\)/m);
    // Declaration comes before usage
    const firstDecl = shader_code.indexOf("vec4 ");
    const firstUse = shader_code.indexOf("ALBEDO = vec3(");
    expect(firstDecl).toBeGreaterThan(-1);
    expect(firstUse).toBeGreaterThan(-1);
    expect(firstDecl).toBeLessThan(firstUse);
    const out_file = path.join(SHADERS_DIR, "godot", "basic_color.gdshader");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("emits optional feature defaults when enabled", async () => {
    const { surface, fragment_output } = basic_color_graph();
    const props = ((fragment_output as any).properties ?? ((fragment_output as any).properties = [])) as any[];
    const enable = (id: string) => {
      const existing = props.find((p) => p && p.id === id);
      if (existing) existing.value = true;
      else props.push({ id, type: "boolean", value: true });
    };
    enable("enable_clearcoat");
    enable("enable_transmission");
    enable("enable_sss");
    enable("enable_sheen");
    enable("enable_anisotropy");
    enable("enable_refraction");
    enable("enable_backlight");

    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "basic_color_features_enabled");
    expect(shader_code).toMatch(/CLEARCOAT\s*=\s*0\.0\s*;/);
    expect(shader_code).toMatch(/CLEARCOAT_ROUGHNESS\s*=\s*0\.5\s*;/);
    expect(shader_code).toMatch(/SSS_STRENGTH\s*=\s*0\.0\s*;/);
    expect(shader_code).toMatch(/SSS_TRANSMITTANCE_COLOR\s*=\s*vec4\(1\.0,\s*0\.8,\s*0\.7,\s*1\.0\)\s*;/);
    expect(shader_code).toMatch(/ANISOTROPY\s*=\s*0\.0\s*;/);
    expect(shader_code).toMatch(/ANISOTROPY_FLOW\s*=\s*vec3\(1\.0,\s*0\.0,\s*0\.0\)\.xy\s*;/);
    // Sheen template should be injected even if values remain defaults
    expect(shader_code).toMatch(/_osg_sheen\s*=\s*vec3\(\s*1\.0,\s*1\.0,\s*1\.0\s*\)\s*\*\s*0\.0/);
  });

  it("addition shader", async () => {
    const { surface } = addition_graph();
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "addition");
    expect(shader_code).toMatch(/vec4 add_\d+ = color_\d+ \+ color_\d+;/);
    expect(shader_code).toMatch(/ALBEDO = vec3\(add_\d+\.rgb\);/);
    const out_file = path.join(SHADERS_DIR, "godot", "addition.gdshader");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("promotes scalar inputs when mixing types", async () => {
    const { surface } = vector_scalar_addition_graph();
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "addition_mixed");
    expect(shader_code).toMatch(/vec4 add_\d+ = color_\d+ \+ vec4\(float_\d+\);/);
    const out_file = path.join(SHADERS_DIR, "godot", "addition_mixed.gdshader");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("float shader from file and compile", async () => {
    const { surface } = float_graph();
    const dir = mkdtempSync(path.join(tmpdir(), "osg-"));
    const graph_path = path.join(dir, "float_graph.json");
    await fs.writeFile(graph_path, JSON.stringify(surface.to_dict(), null, 2), "utf8");
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "float_graph");
    expect(shader_code).toMatch(/float float_\d+ = 0.0;/);
    expect(shader_code).toMatch(/ROUGHNESS = float_\d+;/);
    const out_file = path.join(SHADERS_DIR, "godot", "float_graph.gdshader");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("meta shader includes render_mode", async () => {
    const { surface } = meta_graph();
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "meta");
    expect(shader_code).toMatch(/render_mode blend_mix;/);
    const out_file = path.join(SHADERS_DIR, "godot", "meta.gdshader");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("external graph compiles", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "osg-"));
    const { surface, initial_count } = external_graph(dir);
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "external");
    expect(shader_code).toMatch(/void vertex\(\) \{/);
    expect(surface.graph_data.nodes.length).toBe(initial_count + 1);
    const out_file = path.join(SHADERS_DIR, "godot", "external.gdshader");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("vertex color shader", async () => {
    const { surface } = vertex_color_graph();
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "vertex_color");
    expect(shader_code).toMatch(/void fragment\(\) \{/);
    expect(shader_code).toMatch(/vec3 vertex_position_\d+ = VERTEX;/);
    expect(shader_code).toMatch(/vec3 vertex_normal_\d+ = NORMAL;/);
    expect(shader_code).toMatch(/VERTEX\s*=\s*(?:VERTEX\s*\+\s*)?vec3\(vertex_position_\d+\);/);
    expect(shader_code).toMatch(/NORMAL\s*=\s*vec3\(vertex_normal_\d+\);/);
    expect(shader_code).toMatch(/COLOR\s*=\s*vec4\(color_\d+\);/);
    const out_file = path.join(SHADERS_DIR, "godot", "vertex_color.gdshader");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("exposed addition shader", async () => {
    const { surface } = exposed_addition_graph();
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "exposed");
    expect(shader_code).toMatch(/uniform vec4 color_\d+ = vec4\(1.0, 0.0, 0.0, 1.0\);/);
    expect(shader_code).toMatch(/uniform vec4 color_\d+ = vec4\(0.0, 1.0, 0.0, 1.0\);/);
    expect(shader_code).toMatch(/vec4 add_\d+ = color_\d+ \+ color_\d+;/);
    expect(shader_code).toMatch(/ALBEDO = vec3\(add_\d+\.rgb\);/);
    const out_file = path.join(SHADERS_DIR, "godot", "exposed.gdshader");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("vector constants and texture sampling compile", async () => {
    const { surface } = texture_sampling_graph();
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "texture_sampling");
    expect(shader_code).toMatch(/uniform sampler2D texture_\d+;/);
    expect(shader_code).toMatch(/vec2 float2_\d+ = vec2\(0.5, 0.25\);/);
    expect(shader_code).toMatch(/vec3 float3_\d+ = vec3\(0.1, 0.2, 0.3\);/);
    expect(shader_code).toMatch(/vec4 float4_\d+ = vec4\(0.9, 0.7, 0.5, 0.25\);/);
    expect(shader_code).toMatch(/vec4 texture_sampler_\d+ = texture\(texture_\d+, float2_\d+\);/);
    expect(shader_code).toMatch(/ALBEDO = vec3\(texture_sampler_\d+\.rgb\);/);
    expect(shader_code).toMatch(/EMISSION = vec3\(float3_\d+\)(?:\s*\*\s*[^\n;]+)?;/);
    expect(shader_code).toMatch(/ALPHA = float4_\d+\.x;/);
    expect(shader_code).toContain("wrap: repeat");
    expect(shader_code).toContain("filter: linear");
    expect(shader_code).not.toContain("{{property:");
    const out_file = path.join(SHADERS_DIR, "godot", "texture_sampling.gdshader");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("uses builtin UV when sampler uv input is unconnected", async () => {
    const { surface } = texture_sampler_default_uv_graph();
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "texture_sampler_builtin_uv");
    expect(shader_code).toMatch(/texture\(texture_\d+,\s*UV\)/);
  });

  it("exposes rgb and channel outputs for texture sampler", async () => {
    const { surface } = texture_sampler_channels_graph();
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "texture_sampler_channels");
    expect(shader_code).toMatch(/vec4 texture_sampler_\d+ = texture\(texture_\d+,\s*UV\)/);
    expect(shader_code).toMatch(/ALBEDO = vec3\(texture_sampler_\d+\.rgb\);/);
    expect(shader_code).toMatch(/ROUGHNESS = texture_sampler_\d+\.r;/);
    expect(shader_code).toMatch(/ALPHA = texture_sampler_\d+\.a;/);
  });

  it("emits Godot sampler hint for source_color textures", async () => {
    const { surface, textureNode } = texture_sampling_graph();
    // Set texture type to source_color
    const prop = (textureNode.properties as any[]).find((p) => p.id === "texture_type");
    if (prop) prop.value = "source_color";
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "texture_hint_source_color");
    expect(shader_code).toMatch(/uniform\s+sampler2D\s+texture_\d+\s*:\s*source_color\s*;/);
  });

  it("emits Godot sampler hint for normal map textures", async () => {
    const { surface, textureNode } = texture_sampling_graph();
    // Set texture type to normal (mapped to hint_normal in language pack)
    const prop = (textureNode.properties as any[]).find((p) => p.id === "texture_type");
    if (prop) prop.value = "normal";
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "texture_hint_normal");
    expect(shader_code).toMatch(/uniform\s+sampler2D\s+texture_\d+\s*:\s*hint_normal\s*;/);
  });

  it("does not leak '{{definition}}' placeholder into output (Godot)", async () => {
    const { surface } = exposed_addition_graph();
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "exposed_no_placeholder");
    expect(shader_code).not.toContain("{{definition}}");
  });

  it("dot, normalize, normal/view nodes compile (Godot)", async () => {
    const { surface } = dot_normalize_view_graph();
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "dot_normalize_view");
    expect(shader_code).toMatch(/float dot_\d+ = dot\(/);
    expect(shader_code).toMatch(/vec3 normalize_\d+ = normalize\(/);
  });

  it("fragment output features", async () => {
    const { surface } = full_fragment_graph();
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "fragment_features");
    expect(shader_code).toMatch(/ALBEDO = vec3\(color_\d+\.rgb\);/);
    expect(shader_code).toMatch(/ROUGHNESS = float_\d+;/);
    expect(shader_code).toMatch(/METALLIC = float_\d+;/);
    expect(shader_code).toMatch(/EMISSION = vec3\(color_\d+\.rgb\)(?:\s*\*\s*[^\n;]+)?;/);
    expect(shader_code).toMatch(/NORMAL = vec3\(color_\d+\.rgb\);/);
    expect(shader_code).toMatch(/ALPHA = float_\d+;/);
    const out_file = path.join(SHADERS_DIR, "godot", "fragment_features.gdshader");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("sin node widens legacy scalar pins to vectors", async () => {
    const { surface, sin, mul } = vector_wave_graph();
    // Simulate legacy saved pins that still specify scalar types
    for (const pin of mul.inputs) pin.type = "float";
    mul.outputs[0].type = "float";
    sin.inputs[0].type = "float";
    sin.outputs[0].type = "float";
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "vector_wave_legacy");
    expect(shader_code).toMatch(/vec3 sin_\d+ = sin\(multiply_\d+\);/);
  });

  it("transform node compiles (Godot)", async () => {
    const { surface } = transform_graph();
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "transform_node");
    expect(shader_code).toMatch(/vec3 transform_\d+\s*=\s*/);
  });

  it("logic selectors and fresnel nodes compile", async () => {
    const { surface } = logic_fresnel_graph();
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "logic_fresnel");
    expect(shader_code).toMatch(/float greater_than_\d+ = .* > .* \? 1.0 : 0.0;/);
    expect(shader_code).toMatch(/vec3 select_\d+ = mix\(/);
    expect(shader_code).toMatch(/float fresnel_\d+ = clamp\(/);
    expect(shader_code).toMatch(/EMISSION = vec3\([^;]*fresnel_\d+[^;]*\)(?:\s*\*\s*[^\n;]+)?;/);
  });

  it("cubemap textures compile", async () => {
    const { surface } = cubemap_sampling_graph();
    const shader_code = await compile_graph(surface.to_dict(), "Godot.json", "texture_cube");
    expect(shader_code).toMatch(/samplerCube texture_cube_\d+;/);
    expect(shader_code).toMatch(/vec4 texture_sampler_cube_\d+ = texture\(texture_cube_\d+, normalize\(/);
    expect(shader_code).toMatch(/ALBEDO = vec3\(texture_sampler_cube_\d+\.rgb\);/);
    expect(shader_code).toMatch(/ALPHA = texture_sampler_cube_\d+\.a;/);
  });
});
