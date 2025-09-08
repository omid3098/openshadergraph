import { describe, it, expect, vi } from "vitest";
import {
  runAppLifecycle,
  type AppLifecycleHooks,
  initializeWindows,
  loadExampleGraphs,
  provideGraphData,
  compileGraph,
  updatePreview,
} from "../src/core/lifecycle";

describe("app lifecycle", () => {
  it("runs all lifecycle steps in order with context propagation", async () => {
    const calls: string[] = [];
    const hooks: AppLifecycleHooks<string[], string, string, number> = {
      initializeWindows: vi.fn(async (ctx) => { calls.push("init"); expect(ctx.examples).toBeUndefined(); }),
      loadExampleGraphs: vi.fn(async (ctx) => { calls.push("load"); expect(ctx.examples).toBeUndefined(); return ["example"]; }),
      provideGraphData: vi.fn(async (ctx) => { calls.push("provide"); expect(ctx.examples).toEqual(["example"]); return "graph"; }),
      compileGraph: vi.fn(async (ctx) => { calls.push("compile"); expect(ctx.graph).toBe("graph"); return "glsl"; }),
      updatePreview: vi.fn(async (ctx) => { calls.push("update"); expect(ctx.code).toBe("glsl"); return 42; }),
    };
    const ctx = await runAppLifecycle(hooks);
    expect(calls).toEqual(["init", "load", "provide", "compile", "update"]);
    expect(ctx).toEqual({ examples: ["example"], graph: "graph", code: "glsl", preview: 42 });
    expect(hooks.initializeWindows).toHaveBeenCalledTimes(1);
    expect(hooks.loadExampleGraphs).toHaveBeenCalledTimes(1);
    expect(hooks.provideGraphData).toHaveBeenCalledTimes(1);
    expect(hooks.compileGraph).toHaveBeenCalledTimes(1);
    expect(hooks.updatePreview).toHaveBeenCalledTimes(1);
  });

  it("loads, compiles and prepares preview for example graphs", async () => {
    const ctx = await runAppLifecycle({
      initializeWindows,
      loadExampleGraphs,
      provideGraphData,
      compileGraph,
      updatePreview,
    });
    expect(Array.isArray(ctx.examples)).toBe(true);
    expect(ctx.graph).toBeTruthy();
    expect(typeof ctx.code).toBe("string");
    expect(ctx.code).toMatch(/void\s+main/);
    expect(ctx.preview.fragment).toMatch(/gl_FragColor/);
  });
});
