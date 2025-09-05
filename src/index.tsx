import { serve } from "bun";
import index from "./index.html";
import { promises as fs } from "fs";
import path from "path";

const routes = {
  // Serve index.html for all unmatched routes.
  "/*": index,

  "/api/hello": {
    async GET(_req: Request) {
      return Response.json({
        message: "Hello, world!",
        method: "GET",
      });
    },
    async PUT(_req: Request) {
      return Response.json({
        message: "Hello, world!",
        method: "PUT",
      });
    },
  },

  "/api/hello/:name": async (req: any) => {
    const name = req.params.name;
    return Response.json({
      message: `Hello, ${name}!`,
    });
  },
  "/api/nodes": async () => {
    try {
      const root = path.resolve(process.cwd(), "data", "nodes");
      // Recursively gather all .json files under data/nodes
      const glob = new Bun.Glob("**/*.json");
      const filePaths = Array.from(glob.scanSync({ cwd: root }));

      const items: Array<{
        type: string;
        name: string;
        path: string;
        category: string;
      }> = [];

      for (const relPath of filePaths) {
        try {
          const absPath = path.join(root, relPath);
          const raw = await fs.readFile(absPath, "utf8");
          const json = JSON.parse(raw);
          const type = String(json.type ?? "");
          if (!type) continue;
          const name = String(json.name ?? type);
          const category = relPath.split(path.sep)[0] ?? "root";
          items.push({ type, name, path: relPath, category });
        } catch (err) {
          console.warn("Failed parsing node template:", relPath, err);
        }
      }

      // Group by category for convenience
      const categories: Record<string, typeof items> = {};
      for (const it of items) {
        (categories[it.category] ??= []).push(it);
      }

      // Sort categories and items alphabetically for a consistent palette
      const orderedCategories = Object.keys(categories)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({
          name,
          nodes: categories[name].sort((a, b) => a.name.localeCompare(b.name)),
        }));

      return Response.json({
        categories: orderedCategories,
        flat: items.sort((a, b) => a.name.localeCompare(b.name)),
      });
    } catch (err) {
      console.error("/api/nodes failed:", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
  "/api/node-template": async (req: Request) => {
    try {
      const url = new URL(req.url);
      const rel = url.searchParams.get("path");
      if (!rel) return new Response("Missing path", { status: 400 });
      const root = path.resolve(process.cwd(), "data", "nodes");
      // Normalize and ensure path stays within data/nodes
      const abs = path.resolve(root, rel);
      if (!abs.startsWith(root)) return new Response("Invalid path", { status: 400 });
      const raw = await fs.readFile(abs, "utf8");
      const json = JSON.parse(raw);
      return Response.json(json);
    } catch (err) {
      console.error("/api/node-template failed:", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
  
  // Example graphs: list and fetch prebuilt sample graphs for the UI
  "/api/example-graphs": async (req: Request) => {
    try {
      const url = new URL(req.url);
      const name = url.searchParams.get("name");

      // Build examples using NodeBuilder to match current node templates
      const { NodeBuilder } = await import("./core/graph/node");

      const registry: Array<{ key: string; label: string; build: () => any }> = [
        {
          key: "basic_color",
          label: "Basic Color",
          build: () => {
            const surface = new NodeBuilder("surface");
            const fragment_pass = surface.get_node_by_type("fragment_pass")!;
            const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
            const color = surface.create_node("color", fragment_pass);
            surface.connect_nodes(color, fragment_output, 0, 0);
            return surface.to_dict();
          },
        },
        {
          key: "addition",
          label: "Addition (Color + Color)",
          build: () => {
            const surface = new NodeBuilder("surface");
            const fragment_pass = surface.get_node_by_type("fragment_pass")!;
            const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
            const a = surface.create_node("color", fragment_pass);
            const b = surface.create_node("color", fragment_pass);
            const add = surface.create_node("add", fragment_pass);
            surface.connect_nodes(a, add, 0, 0);
            surface.connect_nodes(b, add, 0, 1);
            surface.connect_nodes(add, fragment_output, 0, 0);
            return surface.to_dict();
          },
        },
        {
          key: "float_to_roughness",
          label: "Float → Roughness",
          build: () => {
            const surface = new NodeBuilder("surface");
            const fragment_pass = surface.get_node_by_type("fragment_pass")!;
            const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
            const flt = surface.create_node("float", fragment_pass);
            // connect float output pin 0 to fragment_output roughness input pin 1
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
            // defaults
            red.inputs[0].value = [1.0, 0.0, 0.0, 1.0];
            green.inputs[0].value = [0.0, 1.0, 0.0, 1.0];
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

      if (name) {
        const found = registry.find((r) => r.key === name);
        if (!found) return new Response("Not Found", { status: 404 });
        const graph = found.build();
        return Response.json({ key: found.key, label: found.label, graph });
      }

      return Response.json({
        examples: registry.map((r) => ({ key: r.key, label: r.label })),
      });
    } catch (err) {
      console.error("/api/example-graphs failed:", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
} as const;

const development = (Bun.env.NODE_ENV ?? process.env.NODE_ENV) !== "production";
const desiredPort = Number(Bun.env.PORT ?? process.env.PORT ?? 3000);

let server: ReturnType<typeof serve>;
try {
  server = serve({ routes, development, port: desiredPort });
} catch (err) {
  const code = (err as any)?.code ?? String(err);
  if (String(code).includes("EADDRINUSE")) {
    console.warn(`⚠️  Port ${desiredPort} in use; selecting a free port...`);
    server = serve({ routes, development, port: 0 });
  } else {
    throw err;
  }
}

console.log(`🚀 Server running at ${server.url}`);
