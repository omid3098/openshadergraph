import { NodeBuilder } from "../core/graph/node";
import { promises as fs } from "fs";
import path from "path";

async function loadExampleFile(abs: string) {
  const raw = await fs.readFile(abs, "utf8");
  try {
    const json = JSON.parse(raw);
    // If file contains a top-level surface wrapper, return that surface node
    const surface = Array.isArray(json.nodes) ? json.nodes.find((n: any) => n && typeof n === "object" && n.type === "surface") : undefined;
    return surface ?? json;
  } catch (err) {
    // If parsing fails, rethrow with context
    throw new Error(`Failed to parse example JSON at ${abs}: ${String(err)}`);
  }
}

function buildProgrammaticRegistry() {
  return [
    {
      key: "float_to_roughness",
      label: "Float → Roughness",
      build: () => {
        const surface = new NodeBuilder("surface");
        const fragment_pass = surface.get_node_by_type("fragment_pass")!;
        const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
        const flt = surface.create_node("float", fragment_pass);
        surface.connect_nodes(flt, fragment_output, 0, 1);
        return surface.to_dict();
      },
    },
    {
      key: "exposed_addition",
      label: "Exposed Addition",
      build: () => {
        const surface = new NodeBuilder("surface");
        const fragment_pass = surface.get_node_by_type("fragment_pass")!;
        const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
        const red = surface.create_node("color", fragment_pass);
        const green = surface.create_node("color", fragment_pass);
        const red0 = Array.isArray(red.inputs) ? red.inputs[0] : undefined;
        if (red0) red0.value = [1.0, 0.0, 0.0, 1.0];
        const green0 = Array.isArray(green.inputs) ? green.inputs[0] : undefined;
        if (green0) green0.value = [0.0, 1.0, 0.0, 1.0];
        red.meta!.push("exposed");
        green.meta!.push("exposed");
        const add = surface.create_node("add", fragment_pass);
        surface.connect_nodes(red, add, 0, 0);
        surface.connect_nodes(green, add, 0, 1);
        surface.connect_nodes(add, fragment_output, 0, 0);
        return surface.to_dict();
      },
    },
    {
      key: "full_fragment",
      label: "Full Fragment Outputs",
      build: () => {
        const surface = new NodeBuilder("surface");
        const fragment_pass = surface.get_node_by_type("fragment_pass")!;
        const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
        const albedo = surface.create_node("color", fragment_pass);
        const rough = surface.create_node("float", fragment_pass);
        const metallic = surface.create_node("float", fragment_pass);
        const emission = surface.create_node("color", fragment_pass);
        const normal = surface.create_node("color", fragment_pass);
        const alpha = surface.create_node("float", fragment_pass);
        surface.connect_nodes(albedo, fragment_output, 0, 0);
        surface.connect_nodes(rough, fragment_output, 0, 1);
        surface.connect_nodes(metallic, fragment_output, 0, 2);
        surface.connect_nodes(emission, fragment_output, 0, 3);
        surface.connect_nodes(normal, fragment_output, 0, 4);
        surface.connect_nodes(alpha, fragment_output, 0, 5);
        return surface.to_dict();
      },
    },
  ];
}

export async function examplesHandler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const name = url.searchParams.get("name");

    // Discover JSON files under the examples directory recursively and build entries.
    // Keys are the relative path from examples/ without the .json extension. Labels are prettified from the final basename.
    const examplesDir = path.resolve(process.cwd(), "examples");
    const entries: Array<{ key: string; label: string; build: () => any }> = [];

    async function walkDir(dir: string, prefix = "") {
      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const it of items) {
        const abs = path.join(dir, it.name);
        if (it.isDirectory()) {
          await walkDir(abs, path.join(prefix, it.name));
          continue;
        }
        if (!it.isFile()) continue;
        if (!it.name.endsWith(".json")) continue;
        const rel = path.join(prefix, it.name);
        const key = rel.replace(/\.json$/i, "").replace(/\\/g, "/");
        const basename = it.name.replace(/\.json$/i, "");
        const label = basename.replace(/_/g, " ").replace(/\b\w/g, (s) => s.toUpperCase());
        entries.push({ key, label, build: async () => await loadExampleFile(abs) });
      }
    }

    try {
      const stat = await fs.stat(examplesDir);
      if (stat.isDirectory()) {
        await walkDir(examplesDir, "");
      }
    } catch (err) {
      // If examples dir missing, continue and rely on programmatic registry
      console.warn("examples: failed to read examples directory", err);
    }

    // Append programmatic examples (used only for direct fetch by name)
    const programmatic = buildProgrammaticRegistry();
    const registry = [...entries, ...programmatic];

    if (name) {
      // When a specific name is requested, search both filesystem entries and programmatic ones
      const found = registry.find((r) => r.key === name);
      if (!found) return new Response("Not Found", { status: 404 });
      const graph = await Promise.resolve(found.build());
      return Response.json({ key: found.key, label: found.label, graph });
    }

    // For listing (menu population) return ONLY filesystem-discovered examples (exclude programmatic examples)
    return Response.json({ examples: entries.map((r) => ({ key: r.key, label: r.label })) });
  } catch (err) {
    console.error("/api/example-graphs failed:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
