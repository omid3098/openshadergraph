import { buildNodeHarness } from "../src/core/testing/nodeHarness";
import { loadLanguage } from "../src/core/schema/registry";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";

async function run() {
  const nodeType = process.argv[2];
  if (!nodeType) throw new Error("Provide node type");
  const langName = process.argv[3] ?? "Godot";
  const harness = buildNodeHarness(nodeType);
  const lang = await loadLanguage(langName);
  const compiler = new GraphCompiler(harness.surface as any, lang as any);
  compiler.compile();
  let code = compiler.result_code;
  if (process.argv.includes("--fragment")) {
    code = code.replace(/\/\/ __VERTEX_PASS_BEGIN__[\s\S]*?\/\/ __VERTEX_PASS_END__/g, "");
    code = code.replace(/uniform\s+([^;=]+?)\s*=\s*[^;]+;/g, "uniform $1;");
  }
  console.log(code);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
