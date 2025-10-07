import { beforeAll, describe, expect, it } from "vitest";
import type { LanguagePack } from "@/core/schema/types";
import { loadLanguage } from "@/core/schema/registry";
import { GraphCompiler } from "@/core/compiler/graphCompiler";
import { buildNodeHarness } from "@/core/testing/nodeHarness";
import type { Graph } from "@/core/graph/types";

let language: LanguagePack;

beforeAll(async () => {
  language = await loadLanguage("ThreeJS_GLSL");
});

function compileSurface(surface: Graph) {
  const compiler = new GraphCompiler(surface, language);
  compiler.compile();
  return compiler.result_code;
}

type Harness = ReturnType<typeof buildNodeHarness>;

function expectVectorLiteralConnection(harness: Harness, pinId: number, expectedType: string, expectedValue: number[]) {
  const input = harness.node.inputs.find((pin) => pin.id === pinId);
  expect(input).toBeDefined();
  const ref = input?.value;
  expect(typeof ref).toBe("string");
  const match = typeof ref === "string" ? ref.match(/^\.\.\/(\d+)\/0$/) : null;
  expect(match).not.toBeNull();
  const literalId = Number(match?.[1]);
  const literalNode = harness.fragmentPass.nodes.find((child) => child.id === literalId);
  expect(literalNode).toBeDefined();
  expect(literalNode?.type).toBe(expectedType);
  const literalInput = literalNode?.inputs?.[0];
  expect(literalInput?.value).toEqual(expectedValue);
}

describe("node harness", () => {
  it("coerces union pin types for math nodes", () => {
    const harness = buildNodeHarness("add", { inputTypeOverrides: { 0: "float3", 1: "float3" } });
    const node = harness.node;
    const metaEntry = (node.meta ?? []).find((entry) => typeof entry === "object" && entry !== null && "current_pintype" in entry) as
      | { current_pintype?: string }
      | undefined;
    expect(node.inputs[0].type).toBe("float3");
    expect(node.inputs[1].type).toBe("float3");
    expectVectorLiteralConnection(harness, 0, "float3", [0.25, 0.5, 0.75]);
    expectVectorLiteralConnection(harness, 1, "float3", [0.25, 0.5, 0.75]);
    expect(node.outputs[0].type).toBe("float3");
    expect(metaEntry?.current_pintype).toBe("float3");

    const albedoInput = harness.fragmentOutput.inputs?.find((input) => input.id === 0);
    expect(albedoInput?.value).toBe(`../${node.id}/0`);
    expect(() => compileSurface(harness.surface)).not.toThrow();
  });

  it("injects texture providers for sampler inputs", () => {
    const harness = buildNodeHarness("texture_sampler");
    const sampler = harness.node;
    const textureNode = harness.fragmentPass.nodes.find((child) => child.type === "texture");
    expect(textureNode).toBeDefined();
    const textureInput = sampler.inputs.find((input) => input.id === 0);
    expect(textureInput?.value).toBe(`../${textureNode?.id}/0`);
    expect(() => compileSurface(harness.surface)).not.toThrow();
  });

  it("fills required vectors for lighting nodes", () => {
    const harness = buildNodeHarness("fresnel");
    expectVectorLiteralConnection(harness, 0, "float3", [0.25, 0.5, 0.75]);
    expectVectorLiteralConnection(harness, 1, "float3", [0.25, 0.5, 0.75]);
    expect(() => compileSurface(harness.surface)).not.toThrow();
  });

  it("supports container nodes with selectable pin types", () => {
    const harness = buildNodeHarness("select", { inputTypeOverrides: { 1: "float3", 2: "float3" } });
    const node = harness.node;
    expect(node.inputs[1].type).toBe("float3");
    expect(node.inputs[2].type).toBe("float3");
    expectVectorLiteralConnection(harness, 1, "float3", [0.25, 0.5, 0.75]);
    expectVectorLiteralConnection(harness, 2, "float3", [0.25, 0.5, 0.75]);
    expect(node.outputs[0].type).toBe("float3");
    expect(() => compileSurface(harness.surface)).not.toThrow();
  });

  it("creates sampler harnesses for parallax workflows", () => {
    const harness = buildNodeHarness("parallax");
    const provider = harness.fragmentPass.nodes.find((child) => child.type === "texture");
    expect(provider).toBeDefined();
    const heightMap = harness.node.inputs.find((input) => input.id === 0);
    expect(heightMap?.value).toBe(`../${provider?.id}/0`);
    const uv = harness.node.inputs.find((input) => input.id === 1);
    expect(uv?.value).toBe("builtin:uv");
    expect(() => compileSurface(harness.surface)).not.toThrow();
  });
});
