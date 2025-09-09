import { promises as fs } from "fs";
import path from "path";
import { materialxToGraph } from "../core/io/materialx";

const EXAMPLES_DIR = path.resolve(process.cwd(), "data", "materialx", "examples");
const EXAMPLES_INDEX = path.resolve(process.cwd(), "data", "materialx", "examples-index.json");
const MATERIALX_EXAMPLES_BASE =
  "https://raw.githubusercontent.com/AcademySoftwareFoundation/MaterialX/59f98fe359728579e0e877a724c1483a6244bd9a/resources/Materials/Examples";

async function readIndex(): Promise<Record<string, string[]>> {
  const txt = await fs.readFile(EXAMPLES_INDEX, "utf8");
  return JSON.parse(txt);
}

async function loadExample(name: string): Promise<string> {
  const file = path.resolve(EXAMPLES_DIR, `${name}.mtlx`);
  try {
    if (!file.startsWith(EXAMPLES_DIR)) throw new Error("Invalid path");
    return await fs.readFile(file, "utf8");
  } catch {
    const url = `${MATERIALX_EXAMPLES_BASE}/${name}.mtlx`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch example: ${res.status}`);
    const xml = await res.text();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, xml, "utf8");
    return xml;
  }
}

function toLabel(str: string): string {
  return str.replace(/[-_]/g, " ").replace(/\b\w/g, (s) => s.toUpperCase());
}

export async function examplesHandler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const name = url.searchParams.get("name");

    if (name) {
      const xml = await loadExample(name);
      const graph = materialxToGraph(xml);
      return Response.json({ key: name, label: toLabel(path.basename(name)), graph });
    }

    const index = await readIndex();
    const groups = Object.entries(index).map(([dir, files]) => ({
      key: dir,
      label: toLabel(dir),
      examples: files.map((f) => ({ key: `${dir}/${f}`, label: toLabel(f) })),
    }));

    return Response.json({ groups });
  } catch (err) {
    console.error("/api/example-graphs failed:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
