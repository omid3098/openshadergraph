import type { LifecycleContext } from "./types";
import type { Graph } from "../graph/types";

export async function provideGraphData(ctx: LifecycleContext<Graph[]>): Promise<Graph> {
  const [first] = ctx.examples ?? [];
  const surface = first?.nodes?.[0];
  if (!surface) throw new Error("No surface node found in examples");
  return surface as Graph;
}
