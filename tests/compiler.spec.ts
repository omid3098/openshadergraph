import { describe, it, expect } from "vitest";
import { compileToGLSL } from "../src/core/compiler/materialxCompiler";

describe("GraphCompiler", () => {
  it("compiles a simple graph to GLSL", async () => {
    const graph = {
      id: 0,
      type: "surface",
      name: "Test",
      meta: [],
      nodes: [
        {
          id: 1,
          type: "color",
          name: "color1",
          meta: [],
          nodes: [],
          inputs: [{ id: 0, name: "in", type: "color4", value: "1,0,0,1" }],
          outputs: [{ id: 0, name: "out", type: "color4" }],
        },
        {
          id: 2,
          type: "fragment_output",
          name: "out",
          meta: [],
          nodes: [],
          inputs: [
            { id: 0, name: "baseColor", type: "color3", value: "../1/0" },
            { id: 1, name: "roughness", type: "float", value: 0.5 },
            { id: 2, name: "metalness", type: "float", value: 0.0 },
            { id: 3, name: "emission", type: "color3", value: "0,0,0" },
            { id: 4, name: "normal", type: "vector3", value: "0,0,1" },
            { id: 5, name: "alpha", type: "float", value: 1.0 },
          ],
          outputs: [],
        },
      ],
      inputs: [],
      outputs: [],
    } as any;

    const code = await compileToGLSL(graph as any);
    expect(code).toContain("gl_FragColor");
    expect(code).toContain("vec4 n1 = vec4(1,0,0,1);");
  });
});

