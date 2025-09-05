import { describe, it, expect } from "vitest";
import { basic_color_graph, exposed_addition_graph } from "./graph_samples";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import { loadLanguage } from "../src/core/schema/registry";
import { parseUniformsAndSanitize } from "../src/core/preview/shaderUtils";

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
    const parsed = parseUniformsAndSanitize(code);
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
    const parsed = parseUniformsAndSanitize(code);
    expect(parsed.fragment).toMatch(/void\s+main\s*\(\s*\)\s*\{/);
    expect(parsed.fragment).toMatch(/gl_FragColor\s*=\s*vec4\(/);
  });
});

