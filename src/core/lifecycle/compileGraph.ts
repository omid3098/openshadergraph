import type { LifecycleContext } from "./types";
import { GraphCompiler } from "../compiler/graphCompiler";
import { loadLanguage } from "../schema/registry";
import type { Graph } from "../graph/types";

export async function compileGraph(ctx: LifecycleContext<any, Graph>): Promise<string> {
  const lang = await loadLanguage("ThreeJS_GLSL.json");
  const compiler = new GraphCompiler(ctx.graph as Graph, lang);
  compiler.compile();
  return compiler.result_code;
}
