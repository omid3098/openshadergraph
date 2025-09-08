import type { AppLifecycleHooks, LifecycleContext } from "./types";

export async function runAppLifecycle<Examples, GraphData, Code, Preview>(
  hooks: AppLifecycleHooks<Examples, GraphData, Code, Preview>
): Promise<LifecycleContext<Examples, GraphData, Code, Preview>> {
  const ctx: LifecycleContext<Examples, GraphData, Code, Preview> = {};
  if (hooks.initializeWindows) await hooks.initializeWindows(ctx);
  ctx.examples = await hooks.loadExampleGraphs(ctx);
  ctx.graph = await hooks.provideGraphData(ctx);
  ctx.code = await hooks.compileGraph(ctx);
  ctx.preview = await hooks.updatePreview(ctx);
  return ctx;
}
