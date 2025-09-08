import type { LifecycleContext } from "./types";
import type { Graph } from "../graph/types";
import { promises as fs } from "fs";
import path from "path";

export async function loadExampleGraphs(_ctx: LifecycleContext): Promise<Graph[]> {
  const dir = path.resolve(process.cwd(), "examples");
  const files = await fs.readdir(dir);
  const graphs: Graph[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const raw = await fs.readFile(path.join(dir, f), "utf8");
    graphs.push(JSON.parse(raw));
  }
  return graphs;
}
