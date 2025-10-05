import { describe, it, expect } from "vitest";
import {
  parseUniformsAndSanitize,
  extractPreviewShaders,
  buildPreviewVertexShader,
} from "../src/core/preview/shaderUtils";

describe("shader utils: parse uniforms and sanitize", () => {
  it("extracts float and vecN uniform initializers", () => {
    const src = `
precision highp float;
uniform float u_time = 1.5;
uniform vec2 u_uv = vec2(0.25, 0.75);
uniform vec3 u_color = vec3(1.0, 0.0, 0.0);
uniform vec4 u_tint = vec4(0.1, 0.2, 0.3, 0.4);
void main(){ gl_FragColor = vec4(u_color, 1.0); }
`;
  const parsed = parseUniformsAndSanitize(src);
  // Sanitized code has no initializers
  expect(parsed.fragment).toMatch(/uniform float u_time;\s/);
  expect(parsed.fragment).toMatch(/uniform vec2 u_uv;\s/);
  expect(parsed.fragment).toMatch(/uniform vec3 u_color;\s/);
  expect(parsed.fragment).toMatch(/uniform vec4 u_tint;\s/);
  // No assignments on uniform declarations
  expect(parsed.fragment).not.toMatch(/uniform\s+\w+\s+\w+\s*=\s*[^;]+;/);
  // Values parsed correctly
  const by = new Map(parsed.uniforms.map((u) => [u.name, u] as const));
  expect(by.get("u_time")?.value).toBeCloseTo(1.5);
  expect(by.get("u_uv")?.value).toEqual([0.25, 0.75]);
  expect(by.get("u_color")?.value).toEqual([1, 0, 0]);
  expect(by.get("u_tint")?.value).toEqual([0.1, 0.2, 0.3, 0.4]);
  expect(parsed.varyings).toEqual([]);
});
});

it("extracts vertex chunk markers and rebuilds vertex shader", () => {
  const code = `precision highp float;\n// __VERTEX_PASS_BEGIN__\nVERTEX = vec3(position);\n// __VERTEX_PASS_END__\nvoid main(){ gl_FragColor = vec4(1.0); }`;
  const { fragment, vertexChunk } = extractPreviewShaders(code);
  expect(vertexChunk).toContain("VERTEX = vec3(position)");
  expect(fragment).not.toContain("__VERTEX_PASS_BEGIN__");
  const vertexShader = buildPreviewVertexShader(vertexChunk);
  expect(vertexShader).toMatch(/#define VERTEX/);
  expect(vertexShader).toMatch(/osg_VertexPosition/);
});

it("adds custom varyings to generated vertex shader", () => {
  const fragment = `precision highp float;\nvarying vec2 vUv;\nvarying vec3 customDir;\nvoid main(){ gl_FragColor = vec4(customDir, 1.0); }`;
  const parsed = parseUniformsAndSanitize(fragment);
  expect(parsed.varyings).toContain("varying vec3 customDir;");
  const vertexShader = buildPreviewVertexShader(undefined, parsed);
  expect(vertexShader).toMatch(/varying vec3 customDir;/);
});

it("extracts multiple vertex pass segments", () => {
  const code = `precision highp float;\n// __VERTEX_PASS_BEGIN__\nVERTEX = VERTEX + vec3(0.0);\n// __VERTEX_PASS_END__\nvoid main() {\n  // __VERTEX_PASS_BEGIN__\n  customVarying = vec3(1.0);\n  // __VERTEX_PASS_END__\n  gl_FragColor = vec4(1.0);\n}`;
  const { fragment, vertexChunk } = extractPreviewShaders(code);
  expect(fragment).not.toContain("__VERTEX_PASS_BEGIN__");
  expect(vertexChunk).toContain("VERTEX = VERTEX + vec3(0.0);");
  expect(vertexChunk).toContain("customVarying = vec3(1.0);");
});
