import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs, rmSync } from "fs";
import path from "path";
import { basic_color_graph, addition_graph, exposed_addition_graph, texture_sampling_graph } from "./graph_samples";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import { loadLanguage } from "../src/core/schema/registry";

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
    // Header and one main()
    expect(shader_code).toMatch(/precision highp float;/);
    const countMain = (shader_code.match(/\bvoid\s+main\s*\(\s*\)/g) ?? []).length;
    expect(countMain).toBe(1);
    // Color declaration and usage with .rgb swizzle
    expect(shader_code).toMatch(/vec4 color_\d+ = vec4\(1.0, 1.0, 1.0, 1.0\);/);
    expect(shader_code).toMatch(/gl_FragColor\s*=\s*vec4\(color_\d+\.rgb,\s*1.0\);/);
    // Declaration comes before usage
    const firstDecl = shader_code.indexOf("vec4 ");
    const firstUse = shader_code.indexOf("gl_FragColor = vec4(");
    expect(firstDecl).toBeGreaterThan(-1);
    expect(firstUse).toBeGreaterThan(-1);
    expect(firstDecl).toBeLessThan(firstUse);
    // Preview uniforms declared without initializers
    expect(shader_code).toMatch(/uniform\s+vec3\s+uKeyDir\s*;/);
    expect(shader_code).toMatch(/uniform\s+vec3\s+uKeyColor\s*;/);
    expect(shader_code).toMatch(/uniform\s+vec3\s+uFillDir\s*;/);
    expect(shader_code).toMatch(/uniform\s+vec3\s+uFillColor\s*;/);
    expect(shader_code).toMatch(/uniform\s+vec3\s+uRimDir\s*;/);
    expect(shader_code).toMatch(/uniform\s+vec3\s+uRimColor\s*;/);
    expect(shader_code).toMatch(/uniform\s+vec3\s+uAmbient\s*;/);
    expect(shader_code).toMatch(/uniform\s+float\s+uExposure\s*;/);
    expect(shader_code).not.toMatch(/uniform\s+\w+\s+u(Key|Fill|Rim)(Dir|Color)\s*=\s*[^;]+;/);
    expect(shader_code).not.toMatch(/uniform\s+vec3\s+uAmbient\s*=\s*[^;]+;/);
    expect(shader_code).not.toMatch(/uniform\s+float\s+uExposure\s*=\s*[^;]+;/);
    const out_file = path.join(SHADERS_DIR, "threejs_glsl", "basic_color.glsl");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("addition shader", async () => {
    const { surface } = addition_graph();
    const shader_code = await compile_graph(surface.to_dict(), "ThreeJS_GLSL.json", "addition");
    expect(shader_code).toMatch(/vec4 add_\d+ = color_\d+ \+ color_\d+;/);
    expect(shader_code).toMatch(/gl_FragColor\s*=\s*vec4\(add_\d+\.rgb,\s*1.0\);/);
    const out_file = path.join(SHADERS_DIR, "threejs_glsl", "addition.glsl");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("vector constants and texture sampling compile", async () => {
    const { surface } = texture_sampling_graph();
    const shader_code = await compile_graph(surface.to_dict(), "ThreeJS_GLSL.json", "texture_sampling");
    expect(shader_code).toMatch(/uniform sampler2D texture_\d+;/);
    expect(shader_code).toMatch(/vec2 float2_\d+ = vec2\(0.5, 0.25\);/);
    expect(shader_code).toMatch(/vec3 float3_\d+ = vec3\(0.1, 0.2, 0.3\);/);
    expect(shader_code).toMatch(/vec4 float4_\d+ = vec4\(0.9, 0.7, 0.5, 0.25\);/);
    expect(shader_code).toMatch(/vec4 texture_sampler_\d+ = texture\(texture_\d+, float2_\d+\);/);
    expect(shader_code).toMatch(/vec3 baseColor\s*=\s*vec3\(texture_sampler_\d+\.rgb\);/);
    expect(shader_code).toMatch(/vec3 emission\s*=\s*vec3\(float3_\d+\);/);
    expect(shader_code).toMatch(/float alpha\s*=\s*float4_\d+\.x;/);
    const out_file = path.join(SHADERS_DIR, "threejs_glsl", "texture_sampling.glsl");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("exposed uniforms are emitted", async () => {
    const { surface } = exposed_addition_graph();
    const shader_code = await compile_graph(surface.to_dict(), "ThreeJS_GLSL.json", "exposed");
    expect(shader_code).toMatch(/uniform vec4 color_\d+ = vec4\(1.0, 0.0, 0.0, 1.0\);/);
    expect(shader_code).toMatch(/uniform vec4 color_\d+ = vec4\(0.0, 1.0, 0.0, 1.0\);/);
    expect(shader_code).toMatch(/vec4 add_\d+ = color_\d+ \+ color_\d+;/);
    expect(shader_code).toMatch(/gl_FragColor\s*=\s*vec4\(add_\d+\.rgb,\s*1.0\);/);
    const out_file = path.join(SHADERS_DIR, "threejs_glsl", "exposed.glsl");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("does not leak '{{definition}}' placeholder into output (ThreeJS)", async () => {
    const { surface } = exposed_addition_graph();
    const shader_code = await compile_graph(surface.to_dict(), "ThreeJS_GLSL.json", "exposed_no_placeholder");
    expect(shader_code).not.toContain("{{definition}}");
  });
});
