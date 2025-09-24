import { promises as fs } from "fs";
import path from "path";
import { validateAssetLibrary } from "../core/schema/validators";

export async function assetsHandler(): Promise<Response> {
  try {
    const primary = path.resolve(process.cwd(), "data", "assets", "library.json");
    const fallback = path.resolve(process.cwd(), "dist", "data", "assets", "library.json");
    const root = await fs.stat(primary).then((s: any) => (s.isFile() ? primary : fallback)).catch(() => fallback);
    const raw = await fs.readFile(root, "utf8");
    const parsed = JSON.parse(raw);
    const library = validateAssetLibrary(parsed);
    const withBuiltin = {
      ...library,
      categories: library.categories.map((category) => ({
        ...category,
        items: category.items.map((item) => ({ ...item, builtin: true })),
      })),
    };
    return Response.json(withBuiltin);
  } catch (err) {
    console.error("/api/assets failed:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
