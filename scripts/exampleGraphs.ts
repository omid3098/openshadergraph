import { promises as fs } from "fs";
import path from "path";
import type { Graph } from "../src/core/graph/types";
import { NodeBuilder } from "../src/core/graph/node";

export type ExampleGraphEntry = { key: string; graph: Graph };

export async function readExampleGraphs(warn?: (msg: string) => void): Promise<ExampleGraphEntry[]> {
  const result: ExampleGraphEntry[] = [];
  const examplesDir = path.resolve(process.cwd(), "examples");

  async function walk(dir: string, prefix = ""): Promise<void> {
    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    for (const entry of entries) {
      const rel = path.join(prefix, entry.name);
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs, rel);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const key = rel.replace(/\.json$/i, "").replace(/\\/g, "/");
      const raw = await fs.readFile(abs, "utf8");
      const json = JSON.parse(raw);
      const surface = Array.isArray(json?.nodes)
        ? (json.nodes.find((n: any) => n && typeof n === "object" && n.type === "surface") as Graph | undefined)
        : undefined;
      const graph = (surface ?? json) as Graph;
      result.push({ key, graph });
    }
  }

  await walk(examplesDir);

  const programmatic = buildProgrammaticExamples();
  for (const entry of programmatic) {
    try {
      const graph = entry.build();
      result.push({ key: entry.key, graph });
    } catch (err) {
      warn?.(`Failed to build programmatic example '${entry.key}': ${(err as Error).message}`);
    }
  }

  if (result.length === 0) {
    throw new Error("No example graphs found. Ensure 'examples/' directory exists or programmatic registry builds.");
  }

  return result;
}

export function ensureSurface(graph: Graph): Graph {
  if (graph.type === "surface") return graph;
  const surface = Array.isArray(graph.nodes)
    ? (graph.nodes.find((node: any) => node && typeof node === "object" && node.type === "surface") as Graph | undefined)
    : undefined;
  if (!surface) {
    throw new Error("Graph missing root 'surface' node.");
  }
  return surface;
}

function buildProgrammaticExamples(): Array<{ key: string; build: () => Graph }> {
  return [
    {
      key: "float_to_roughness",
      build: () => {
        const surfaceBuilder = new NodeBuilder("surface");
        const fragmentPass = surfaceBuilder.get_node_by_type("fragment_pass");
        if (!fragmentPass) throw new Error("Programmatic example missing fragment_pass");
        const fragmentOutput = surfaceBuilder.find_nested_node_by_type(fragmentPass, "fragment_output");
        if (!fragmentOutput) throw new Error("Programmatic example missing fragment_output");
        const floatNode = surfaceBuilder.create_node("float", fragmentPass);
        surfaceBuilder.connect_nodes(floatNode, fragmentOutput, 0, 1);
        return surfaceBuilder.to_dict();
      },
    },
    {
      key: "exposed_addition",
      build: () => {
        const surfaceBuilder = new NodeBuilder("surface");
        const fragmentPass = surfaceBuilder.get_node_by_type("fragment_pass");
        if (!fragmentPass) throw new Error("Programmatic example missing fragment_pass");
        const fragmentOutput = surfaceBuilder.find_nested_node_by_type(fragmentPass, "fragment_output");
        if (!fragmentOutput) throw new Error("Programmatic example missing fragment_output");
        const red = surfaceBuilder.create_node("color", fragmentPass);
        const green = surfaceBuilder.create_node("color", fragmentPass);
        const redInput = red.inputs?.[0];
        const greenInput = green.inputs?.[0];
        if (redInput) redInput.value = [1.0, 0.0, 0.0, 1.0];
        if (greenInput) greenInput.value = [0.0, 1.0, 0.0, 1.0];
        red.meta?.push("exposed");
        green.meta?.push("exposed");
        const add = surfaceBuilder.create_node("add", fragmentPass);
        surfaceBuilder.connect_nodes(red, add, 0, 0);
        surfaceBuilder.connect_nodes(green, add, 0, 1);
        surfaceBuilder.connect_nodes(add, fragmentOutput, 0, 0);
        return surfaceBuilder.to_dict();
      },
    },
    {
      key: "full_fragment",
      build: () => {
        const surfaceBuilder = new NodeBuilder("surface");
        const fragmentPass = surfaceBuilder.get_node_by_type("fragment_pass");
        if (!fragmentPass) throw new Error("Programmatic example missing fragment_pass");
        const fragmentOutput = surfaceBuilder.find_nested_node_by_type(fragmentPass, "fragment_output");
        if (!fragmentOutput) throw new Error("Programmatic example missing fragment_output");
        const albedo = surfaceBuilder.create_node("color", fragmentPass);
        const rough = surfaceBuilder.create_node("float", fragmentPass);
        const metallic = surfaceBuilder.create_node("float", fragmentPass);
        const emission = surfaceBuilder.create_node("color", fragmentPass);
        const normal = surfaceBuilder.create_node("color", fragmentPass);
        const alpha = surfaceBuilder.create_node("float", fragmentPass);
        surfaceBuilder.connect_nodes(albedo, fragmentOutput, 0, 0);
        surfaceBuilder.connect_nodes(rough, fragmentOutput, 0, 1);
        surfaceBuilder.connect_nodes(metallic, fragmentOutput, 0, 2);
        surfaceBuilder.connect_nodes(emission, fragmentOutput, 0, 3);
        surfaceBuilder.connect_nodes(normal, fragmentOutput, 0, 4);
        surfaceBuilder.connect_nodes(alpha, fragmentOutput, 0, 5);
        return surfaceBuilder.to_dict();
      },
    },
  ];
}
