import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs, rmSync } from "fs";
import path from "path";
import { basic_color_graph, addition_graph, vector_scalar_addition_graph, exposed_addition_graph, texture_sampling_graph, texture_sampler_default_uv_graph, texture_sampler_channels_graph, dot_normalize_view_graph, transform_graph } from "./graph_samples";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import { loadLanguage } from "../src/core/schema/registry";
import { extractPreviewShaders, parseUniformsAndSanitize } from "../src/core/preview/shaderUtils";

const ROOT = process.cwd();
const SHADERS_DIR = path.join(ROOT, "tests", "shaders");
const ENGINE_DIR = path.join(SHADERS_DIR, "threejs_glsl");

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

describe("ThreeJS GLSL shader generation", () => {
  beforeAll(() => {
    rmSync(ENGINE_DIR, { recursive: true, force: true });
  });

  it("basic color shader", async () => {
    const { surface } = basic_color_graph();
    const shader_code = await compile_graph(surface.to_dict(), "ThreeJS_GLSL.json", "basic_color");
    const { fragment, vertexChunk } = extractPreviewShaders(shader_code);
    expect(vertexChunk).not.toContain("__VERTEX_PASS_BEGIN__");
    const parsed = parseUniformsAndSanitize(fragment);
    // Header and one main()
    expect(parsed.fragment).toMatch(/precision highp float;/);
    const countMain = (parsed.fragment.match(/\bvoid\s+main\s*\(\s*\)/g) ?? []).length;
    expect(countMain).toBe(1);
    // Color declaration and usage with .rgb swizzle
    expect(parsed.fragment).toMatch(/vec4 color_\d+ = vec4\(1.0, 1.0, 1.0, 1.0\);/);
    expect(parsed.fragment).toMatch(/vec3 baseColor\s*=\s*vec3\(color_\d+\.rgb\);/);
    expect(parsed.fragment).toMatch(/gl_FragColor\s*=\s*vec4\(color,\s*outAlpha\);/);
    // Declaration comes before usage
    const firstDecl = parsed.fragment.indexOf("vec4 ");
    const firstUse = parsed.fragment.indexOf("gl_FragColor = vec4(color, outAlpha);");
    expect(firstDecl).toBeGreaterThan(-1);
    expect(firstUse).toBeGreaterThan(-1);
    expect(firstDecl).toBeLessThan(firstUse);
    // Preview uniforms declared without initializers
    expect(parsed.fragment).toMatch(/uniform\s+vec3\s+uKeyDir\s*;/);
    expect(parsed.fragment).toMatch(/uniform\s+vec3\s+uKeyColor\s*;/);
    expect(parsed.fragment).toMatch(/uniform\s+vec3\s+uFillDir\s*;/);
    expect(parsed.fragment).toMatch(/uniform\s+vec3\s+uFillColor\s*;/);
    expect(parsed.fragment).toMatch(/uniform\s+vec3\s+uRimDir\s*;/);
    expect(parsed.fragment).toMatch(/uniform\s+vec3\s+uRimColor\s*;/);
    expect(parsed.fragment).toMatch(/uniform\s+vec3\s+uAmbient\s*;/);
    expect(parsed.fragment).toMatch(/uniform\s+float\s+uExposure\s*;/);
    expect(parsed.fragment).toMatch(/uniform\s+float\s+uTime\s*;/);
    expect(shader_code).not.toMatch(/uniform\s+\w+\s+u(Key|Fill|Rim)(Dir|Color)\s*=\s*[^;]+;/);
    expect(shader_code).not.toMatch(/uniform\s+vec3\s+uAmbient\s*=\s*[^;]+;/);
    expect(shader_code).not.toMatch(/uniform\s+float\s+uExposure\s*=\s*[^;]+;/);
    expect(shader_code).not.toMatch(/uniform\s+float\s+uTime\s*=\s*[^;]+;/);
    expect(vertexChunk).toMatch(/VERTEX\s*=\s*(?:VERTEX\s*\+\s*)?vec3/);
    const out_file = path.join(SHADERS_DIR, "threejs_glsl", "basic_color.glsl");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("unlit shading compiles for empty PBR graph when switching shading_model", async () => {
    const { surface, fragment_output } = basic_color_graph();
    // Explicitly set shading_model to unlit via properties to simulate UI change
    const props = ((fragment_output as any).properties ?? ((fragment_output as any).properties = [])) as any[];
    const existing = props.find((p) => p && p.id === "shading_model");
    if (existing) existing.value = "unlit"; else props.push({ id: "shading_model", type: "enum", value: "unlit" });
    const shader_code = await compile_graph(surface.to_dict(), "ThreeJS_GLSL.json", "unlit_basic");
    const { fragment } = extractPreviewShaders(shader_code);
    // Should select unlit branch and produce a single main with gl_FragColor assignment
    expect(fragment).toMatch(/#define SHADING_UNLIT 1/);
    const countMain = (fragment.match(/\bvoid\s+main\s*\(\s*\)/g) ?? []).length;
    expect(countMain).toBe(1);
    expect(fragment).toMatch(/gl_FragColor\s*=\s*vec4\(/);
  });

  it("addition shader", async () => {
    const { surface } = addition_graph();
    const shader_code = await compile_graph(surface.to_dict(), "ThreeJS_GLSL.json", "addition");
    const { fragment } = extractPreviewShaders(shader_code);
    expect(fragment).toMatch(/vec4 add_\d+ = color_\d+ \+ color_\d+;/);
    expect(fragment).toMatch(/vec3 baseColor\s*=\s*vec3\(add_\d+\.rgb\);/);
    expect(fragment).toMatch(/gl_FragColor\s*=\s*vec4\(color,\s*outAlpha\);/);
    const out_file = path.join(SHADERS_DIR, "threejs_glsl", "addition.glsl");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("promotes scalar inputs when mixing types", async () => {
    const { surface } = vector_scalar_addition_graph();
    const shader_code = await compile_graph(surface.to_dict(), "ThreeJS_GLSL.json", "addition_mixed");
    const { fragment } = extractPreviewShaders(shader_code);
    expect(fragment).toMatch(/vec4 add_\d+ = color_\d+ \+ vec4\(float_\d+\);/);
    const out_file = path.join(SHADERS_DIR, "threejs_glsl", "addition_mixed.glsl");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("vector constants and texture sampling compile", async () => {
    const { surface } = texture_sampling_graph();
    const shader_code = await compile_graph(surface.to_dict(), "ThreeJS_GLSL.json", "texture_sampling");
    const { fragment } = extractPreviewShaders(shader_code);
    expect(fragment).toMatch(/uniform sampler2D texture_\d+;/);
    expect(fragment).toMatch(/vec2 float2_\d+ = vec2\(0.5, 0.25\);/);
    expect(fragment).toMatch(/vec3 float3_\d+ = vec3\(0.1, 0.2, 0.3\);/);
    expect(fragment).toMatch(/vec4 float4_\d+ = vec4\(0.9, 0.7, 0.5, 0.25\);/);
    expect(fragment).toMatch(/vec4 texture_sampler_\d+ = texture\(texture_\d+, float2_\d+\);/);
    expect(fragment).toMatch(/vec3 baseColor\s*=\s*vec3\(texture_sampler_\d+\.rgb\);/);
    expect(fragment).toMatch(/vec3 emission\s*=\s*vec3\(float3_\d+\)(?:\s*\*\s*[^\n;]+)?;/);
    expect(fragment).toMatch(/float alpha\s*=\s*float4_\d+\.x;/);
    expect(fragment).toContain("wrap: repeat");
    expect(fragment).toContain("filter: linear");
    expect(fragment).not.toContain("{{property:");
    const out_file = path.join(SHADERS_DIR, "threejs_glsl", "texture_sampling.glsl");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("uses builtin vUv when sampler uv input is unconnected", async () => {
    const { surface } = texture_sampler_default_uv_graph();
    const shader_code = await compile_graph(surface.to_dict(), "ThreeJS_GLSL.json", "texture_sampler_builtin_uv");
    const { fragment } = extractPreviewShaders(shader_code);
    expect(fragment).toMatch(/texture\(texture_\d+,\s*vUv\)/);
  });

  it("exposes rgb and channel outputs for texture sampler (ThreeJS)", async () => {
    const { surface } = texture_sampler_channels_graph();
    const shader_code = await compile_graph(surface.to_dict(), "ThreeJS_GLSL.json", "texture_sampler_channels");
    const { fragment } = extractPreviewShaders(shader_code);
    expect(fragment).toMatch(/vec4 texture_sampler_\d+ = texture\(texture_\d+,\s*vUv\)/);
    expect(fragment).toMatch(/vec3 baseColor\s*=\s*vec3\(texture_sampler_\d+\.rgb\);/);
    expect(fragment).toMatch(/roughness[^\n]*texture_sampler_\d+\.r/);
    expect(fragment).toMatch(/float alpha\s*=\s*texture_sampler_\d+\.a;/);
  });

  it("exposed uniforms are emitted", async () => {
    const { surface } = exposed_addition_graph();
    const shader_code = await compile_graph(surface.to_dict(), "ThreeJS_GLSL.json", "exposed");
    const { fragment } = extractPreviewShaders(shader_code);
    expect(fragment).toMatch(/uniform vec4 color_\d+ = vec4\(1.0, 0.0, 0.0, 1.0\);/);
    expect(fragment).toMatch(/uniform vec4 color_\d+ = vec4\(0.0, 1.0, 0.0, 1.0\);/);
    expect(fragment).toMatch(/vec4 add_\d+ = color_\d+ \+ color_\d+;/);
    expect(fragment).toMatch(/vec3 baseColor\s*=\s*vec3\(add_\d+\.rgb\);/);
    expect(fragment).toMatch(/gl_FragColor\s*=\s*vec4\(color,\s*outAlpha\);/);
    const out_file = path.join(SHADERS_DIR, "threejs_glsl", "exposed.glsl");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("does not leak '{{definition}}' placeholder into output (ThreeJS)", async () => {
    const { surface } = exposed_addition_graph();
    const shader_code = await compile_graph(surface.to_dict(), "ThreeJS_GLSL.json", "exposed_no_placeholder");
    const { fragment } = extractPreviewShaders(shader_code);
    expect(fragment).not.toContain("{{definition}}");
  });

  it("wires position node through vertex varyings", async () => {
    const raw = await fs.readFile(path.join(ROOT, "examples", "lerp_color.json"), "utf8");
    const graph = JSON.parse(raw);
    const surface = graph.nodes.find((node: any) => node?.type === "surface");
    expect(surface).toBeTruthy();
    const shader_code = await compile_graph(surface, "ThreeJS_GLSL.json", "lerp_color_varyings");
    const { fragment, vertexChunk } = extractPreviewShaders(shader_code);
    expect(fragment).toMatch(/varying vec3 osg_vposition_\d+;/);
    expect(fragment).toMatch(/vec3 position_\d+ = osg_vposition_\d+;/);
    expect(vertexChunk).toMatch(/osg_vposition_\d+ = osg_position_\d+_obj;/);
  });

  it("dot, normalize, normal/view nodes compile (ThreeJS)", async () => {
    const { surface } = dot_normalize_view_graph();
    const shader_code = await compile_graph(surface.to_dict(), "ThreeJS_GLSL.json", "dot_normalize_view");
    const { fragment } = extractPreviewShaders(shader_code);
    expect(fragment).toMatch(/float dot_\d+ = dot\(/);
    expect(fragment).toMatch(/vec3 normalize_\d+ = normalize\(/);
  });

  it("transform node compiles (ThreeJS)", async () => {
    const { surface } = transform_graph();
    const shader_code = await compile_graph(surface.to_dict(), "ThreeJS_GLSL.json", "transform_node");
    const { fragment } = extractPreviewShaders(shader_code);
    expect(fragment).toMatch(/vec3 transform_\d+\s*=\s*/);
  });
});
