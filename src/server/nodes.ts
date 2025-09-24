import { promises as fs } from "fs";
import path from "path";

export async function nodesListHandler(): Promise<Response> {
  try {
    const root = path.resolve(process.cwd(), "data", "nodes");
    try {
      const st = await fs.stat(root);
      if (!st.isDirectory()) {
        return Response.json({ error: "OSG data missing: 'data/nodes' is not a directory" }, { status: 500 });
      }
    } catch (err) {
      return Response.json({ error: "OSG data missing: 'data/nodes' directory not found" }, { status: 500 });
    }

    const items: Array<{ type: string; name: string; path: string; category: string }> = [];
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
            const type = String(json.type ?? "");
            if (!type) continue;
            const name = String(json.name ?? type);
            // Determine category from directory segment, not filename
            const dirPart = prefix ? prefix.split(path.sep)[0] : "";
            const category = dirPart || "root";
            items.push({ type, name, path: rel, category });
          } catch (err) {
            console.warn("Failed parsing node template:", rel, err);
          }
        }
      }
    }
    await walk(root);

    const categories: Record<string, typeof items> = {};
    for (const it of items) {
      const key = it.category ?? "root";
      (categories[key] ??= []).push(it);
    }

    const orderedCategories = Object.keys(categories)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        name,
        nodes: categories[name]
          .map((n) => ({ ...n, path: n.path }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }));

    return Response.json({
      categories: orderedCategories,
      flat: items.sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (err) {
    console.error("/api/nodes failed:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function nodeTemplateHandler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const rel = url.searchParams.get("path");
    if (!rel) return new Response("Missing path", { status: 400 });
    const root = path.resolve(process.cwd(), "data", "nodes");
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(root)) return new Response("Invalid path", { status: 400 });
    try {
      await fs.stat(abs);
    } catch {
      return Response.json({ error: `Node template not found: ${rel}` }, { status: 404 });
    }
    const raw = await fs.readFile(abs, "utf8");
    const json = JSON.parse(raw);
    return Response.json(json);
  } catch (err) {
    console.error("/api/node-template failed:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

