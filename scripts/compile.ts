import { promises as fs } from "fs";
import path from "path";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import { loadLanguage } from "../src/core/schema/registry";

async function main() {
  const graphPath = process.argv[2] ?? "examples/lerp_color.json";
  const langName = process.argv[3] ?? "Bevy_WGSL.json";
  const absGraph = path.isAbsolute(graphPath) ? graphPath : path.resolve(process.cwd(), graphPath);
  const raw = await fs.readFile(absGraph, "utf8");
  const loaded = JSON.parse(raw);
  // Accept example payloads that wrap the root graph under .nodes
  const graph = Array.isArray(loaded?.nodes) ? loaded.nodes[0] ?? loaded : loaded;
  const lang = await loadLanguage(langName);
  const compiler = new GraphCompiler(graph, lang);
  compiler.compile();
  console.log(compiler.result_code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


