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
