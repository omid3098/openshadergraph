import { promises as fs } from "fs";
import path from "path";
import { validateAssetLibrary } from "../core/schema/validators";

export async function assetsHandler(): Promise<Response> {
  try {
    const abs = path.resolve(process.cwd(), "data", "assets", "library.json");
    try {
      const st = await fs.stat(abs);
      if (!st.isFile()) {
        return Response.json({ error: "OSG data missing: 'data/assets/library.json' is not a file" }, { status: 500 });
      }
    } catch (err) {
      return Response.json({ error: "OSG data missing: 'data/assets/library.json' not found" }, { status: 500 });
    }
    const raw = await fs.readFile(abs, "utf8");
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
