import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { loadLanguage } from "../src/core/schema/registry";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import { ensureSurface } from "../scripts/exampleGraphs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const rel = process.argv[2];
  if (!rel) throw new Error("pass example relative path");
  const abs = path.resolve(__dirname, "../", rel);
  const raw = await readFile(abs, "utf8");
  const graph = JSON.parse(raw);
  const surface = ensureSurface(graph as any);
  const lang = await loadLanguage("Godot");
  const compiler = new GraphCompiler(surface as any, lang as any);
  compiler.compile();
  console.log(compiler.result_code);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
