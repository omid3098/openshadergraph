import { describe, it, expect } from "vitest";
import { parseUniformsAndSanitize, toThreeUniforms, defaultVertexShader } from "../src/core/preview/shaderUtils";

describe("shaderUtils", () => {
  it("parses uniforms and strips them from fragment", () => {
    const src = `
      uniform float uExposure = 1.2;
      uniform vec3 uColor = vec3(1.0, 0.5, 0.0);
      void main() { gl_FragColor = vec4(uColor, uExposure); }
    `;
    const res = parseUniformsAndSanitize(src);
    expect(res.uniforms.uExposure.value).toBeCloseTo(1.2);
    expect(res.uniforms.uColor.value).toEqual([1, 0.5, 0]);
    expect(res.fragment).not.toMatch(/uniform/);
  });

  it("creates Three uniform map", () => {
    const uniforms = toThreeUniforms({ uTime: { type: "float", value: 0.5 } });
    expect(uniforms).toEqual({ uTime: { value: 0.5 } });
  });

  it("provides default vertex shader", () => {
    const v = defaultVertexShader();
    expect(v).toMatch(/gl_Position/);
  });
});
