import { describe, it, expect } from "vitest";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import { loadLanguage } from "../src/core/schema/registry";
import { addition_graph } from "./graph_samples";

function deepClone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

describe("Compiler does not mutate input graph and preserves order", () => {
  it("compiles without mutating inputs, children order, or IDs", async () => {
    const { surface, fragment_pass } = addition_graph();
    const original = surface.to_dict();
    // Capture a deep copy for comparison
    const snapshot = deepClone(original);
    const lang = await loadLanguage("ThreeJS_GLSL.json");
    const compiler = new GraphCompiler(original as any, lang);
    compiler.compile();

    // Graph root unchanged
    expect(original).toEqual(snapshot);
    // Order preserved for fragment_pass children
    const beforeSurface = snapshot as any;
    const afterSurface = original as any;
    const beforeFragmentPass = (beforeSurface.nodes ?? []).find((n: any) => n.type === "fragment_pass");
    const afterFragmentPass = (afterSurface.nodes ?? []).find((n: any) => n.type === "fragment_pass");
    const beforeIds = (beforeFragmentPass?.nodes ?? []).map((n: any) => n.id);
    const afterIds = (afterFragmentPass?.nodes ?? []).map((n: any) => n.id);
    expect(afterIds).toEqual(beforeIds);
  });
});


