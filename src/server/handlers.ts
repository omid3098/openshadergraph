import { promises as fs } from "fs";
import path from "path";
import { loadLanguage } from "../core/schema/registry";

export type LanguageItem = { key: string; name: string; path: string };

export async function languagesHandler(): Promise<Response> {
  try {
    const root = path.resolve(process.cwd(), "data", "languages");
    // Recursively list .json files without relying on Bun.Glob (for Node test env)
    const items: LanguageItem[] = [];
    async function walk(dir: string, prefix = ""): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true } as any);
      for (const e of entries as any[]) {
        const rel = path.join(prefix, e.name);
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) {
          await walk(abs, rel);
        } else if (e.isFile() && e.name.endsWith(".json")) {
          try {
            const raw = await fs.readFile(abs, "utf8");
            const json = JSON.parse(raw);
            const key = rel.replace(/\.json$/i, "");
            const name = String(json.name ?? key);
            items.push({ key, name, path: rel });
          } catch (err) {
            console.warn("Failed parsing language pack:", rel, err);
          }
        }
      }
    }
    await walk(root);
    items.sort((a, b) => a.name.localeCompare(b.name));
    return Response.json({ languages: items });
  } catch (err) {
    console.error("languagesHandler failed:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function languagePackHandler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const name = url.searchParams.get("name") ?? "ThreeJS_GLSL";
    // Accept both key without extension and full filename
    const key = name.endsWith(".json") ? name : `${name}.json`;
    const lang = await loadLanguage(key);
    return Response.json(lang);
  } catch (err) {
    console.error("languagePackHandler failed:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function compileHandler(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const graph = body?.graph ?? null;
    const language = body?.language ?? "ThreeJS_GLSL";
    if (!graph || typeof graph !== "object") return new Response("Missing graph", { status: 400 });
    // Normalize root: If wrapper root has empty type, find the first 'surface'
    let rootGraph = graph as any;
    if (!rootGraph.type || rootGraph.type === "") {
      const surface = Array.isArray(rootGraph.nodes) ? rootGraph.nodes.find((n: any) => n?.type === "surface") : undefined;
      if (surface) rootGraph = surface;
      else return new Response("Root graph must include a 'surface' node", { status: 400 });
    }
    const { loadLanguage } = await import("../core/schema/registry");
    const { GraphCompiler } = await import("../core/compiler/graphCompiler");
    const lang = await loadLanguage(language);
    const compiler = new GraphCompiler(rootGraph, lang);
    compiler.compile();
    return Response.json({ language: lang.name ?? language, code: compiler.result_code });
  } catch (err) {
    console.error("compileHandler failed:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
