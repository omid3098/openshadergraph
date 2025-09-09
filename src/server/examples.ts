import { promises as fs } from "fs";
import path from "path";
import { materialxToGraph } from "../core/io/materialx";

export async function examplesHandler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const name = url.searchParams.get("name");

    const examplesDir = path.resolve(process.cwd(), "data", "materialx", "examples");
    const files = await fs.readdir(examplesDir);
    const registry = files
      .filter((f) => f.endsWith(".mtlx"))
      .map((f) => {
        const key = path.basename(f, ".mtlx");
        const label = key.replace(/[-_]/g, " ").replace(/\b\w/g, (s) => s.toUpperCase());
        return { key, label, file: path.join(examplesDir, f) };
      });

    if (name) {
      const found = registry.find((r) => r.key === name);
      if (!found) return new Response("Not Found", { status: 404 });
      const xml = await fs.readFile(found.file, "utf8");
      const graph = materialxToGraph(xml);
      return Response.json({ key: found.key, label: found.label, graph });
    }

    return Response.json({ examples: registry.map((r) => ({ key: r.key, label: r.label })) });
  } catch (err) {
    console.error("/api/example-graphs failed:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
