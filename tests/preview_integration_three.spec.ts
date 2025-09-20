import { describe, it, expect } from "vitest";
import { basic_color_graph, exposed_addition_graph, texture_sampling_graph } from "./graph_samples";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import { loadLanguage } from "../src/core/schema/registry";
import { parseUniformsAndSanitize, extractPreviewShaders } from "../src/core/preview/shaderUtils";

async function compileThree(glGraph: any) {
  const lang = await loadLanguage("ThreeJS_GLSL.json");
  const compiler = new GraphCompiler(glGraph, lang);
  compiler.compile();
  return compiler.result_code;
}

describe("preview integration (ThreeJS_GLSL)", () => {
  it("sanitizes exposed uniform initializers", async () => {
    const { surface } = exposed_addition_graph();
    const code = await compileThree(surface.to_dict());
    const { fragment, vertexChunk } = extractPreviewShaders(code);
    expect(vertexChunk).toContain("VERTEX =");
    const parsed = parseUniformsAndSanitize(fragment);
    // ensure exposed uniforms present but without initializers
    const hasUniforms = /uniform\s+vec4\s+color_\d+;/.test(parsed.fragment);
    expect(hasUniforms).toBe(true);
    // no assignment on uniform lines
    const bad = parsed.fragment.match(/uniform\s+\w+\s+\w+\s*=\s*[^;]+;/g);
    expect(bad).toBeNull();
    // values captured
    const names = parsed.uniforms.map((u) => u.name);
    expect(names.some((n) => /color_\d+/.test(n))).toBe(true);
  });

  it("plain color graph produces a compilable fragment", async () => {
    const { surface } = basic_color_graph();
    const code = await compileThree(surface.to_dict());
    const { fragment } = extractPreviewShaders(code);
    const parsed = parseUniformsAndSanitize(fragment);
    expect(parsed.fragment).toMatch(/void\s+main\s*\(\s*\)\s*\{/);
    expect(parsed.fragment).toMatch(/gl_FragColor\s*=\s*vec4\(/);
  });

  it("declares preview uniforms without initializers (owned by preview)", async () => {
    const { surface } = basic_color_graph();
    const code = await compileThree(surface.to_dict());
    const { fragment } = extractPreviewShaders(code);
    const parsed = parseUniformsAndSanitize(fragment);
    // preview uniforms are declared (no defaults baked in)
    expect(parsed.fragment).toMatch(/uniform\s+vec3\s+uKeyDir\s*;/);
    expect(parsed.fragment).toMatch(/uniform\s+vec3\s+uKeyColor\s*;/);
    expect(parsed.fragment).toMatch(/uniform\s+vec3\s+uFillDir\s*;/);
    expect(parsed.fragment).toMatch(/uniform\s+vec3\s+uFillColor\s*;/);
    expect(parsed.fragment).toMatch(/uniform\s+vec3\s+uRimDir\s*;/);
    expect(parsed.fragment).toMatch(/uniform\s+vec3\s+uRimColor\s*;/);
    expect(parsed.fragment).toMatch(/uniform\s+vec3\s+uAmbient\s*;/);
    expect(parsed.fragment).toMatch(/uniform\s+float\s+uExposure\s*;/);
    expect(parsed.fragment).toMatch(/uniform\s+float\s+uTime\s*;/);
    // raw code must not have initializers for these preview uniforms
    expect(code).not.toMatch(/uniform\s+vec3\s+uKeyDir\s*=\s*[^;]+;/);
    expect(code).not.toMatch(/uniform\s+vec3\s+uKeyColor\s*=\s*[^;]+;/);
    expect(code).not.toMatch(/uniform\s+vec3\s+uFillDir\s*=\s*[^;]+;/);
    expect(code).not.toMatch(/uniform\s+vec3\s+uFillColor\s*=\s*[^;]+;/);
    expect(code).not.toMatch(/uniform\s+vec3\s+uRimDir\s*=\s*[^;]+;/);
    expect(code).not.toMatch(/uniform\s+vec3\s+uRimColor\s*=\s*[^;]+;/);
    expect(code).not.toMatch(/uniform\s+vec3\s+uAmbient\s*=\s*[^;]+;/);
    expect(code).not.toMatch(/uniform\s+float\s+uExposure\s*=\s*[^;]+;/);
    expect(code).not.toMatch(/uniform\s+float\s+uTime\s*=\s*[^;]+;/);
    // sanitizer should not capture values for preview uniforms (since none exist)
    const names = parsed.uniforms.map((u) => u.name);
    expect(names).not.toContain("uKeyDir");
    expect(names).not.toContain("uKeyColor");
    expect(names).not.toContain("uFillDir");
    expect(names).not.toContain("uFillColor");
    expect(names).not.toContain("uRimDir");
    expect(names).not.toContain("uRimColor");
    expect(names).not.toContain("uAmbient");
    expect(names).not.toContain("uExposure");
    expect(names).not.toContain("uTime");
  });

  it("does not include viewMatrix transforms for light directions (handled in preview)", async () => {
    const { surface } = basic_color_graph();
    const code = await compileThree(surface.to_dict());
    expect(code).not.toMatch(/viewMatrix\s*\*\s*vec4\(uKeyDir,\s*0\.0\)/);
    expect(code).not.toMatch(/viewMatrix\s*\*\s*vec4\(uFillDir,\s*0\.0\)/);
    expect(code).not.toMatch(/viewMatrix\s*\*\s*vec4\(uRimDir,\s*0\.0\)/);
  });

  it("collects sampler uniforms for placeholder assignment", async () => {
    const { surface } = texture_sampling_graph();
    const code = await compileThree(surface.to_dict());
    const { fragment } = extractPreviewShaders(code);
    const parsed = parseUniformsAndSanitize(fragment);
    expect(parsed.samplers.some((sampler) => sampler.name.startsWith("texture_"))).toBe(true);
  });
});
