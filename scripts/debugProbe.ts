import { buildProbeGraph } from "../src/core/preview/probeGraph";
import { loadLanguage } from "../src/core/schema/registry";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";

async function main() {
  const probeNode = {
    id: 30,
    type: "editor_probe",
    meta: ["editor_node", "editor_widget:probe"],
    nodes: [],
    inputs: [
      { id: 0, name: "input", type: ["float2"], value: "../20/0" },
    ],
    outputs: [],
    properties: [],
  } as any;

  const uvNode = {
    id: 20,
    type: "uv",
    nodes: [],
    inputs: [],
    outputs: [{ id: 0, name: "uv", type: "float2" }],
    properties: [],
  } as any;

  const fragmentPass = {
    id: 10,
    type: "fragment_pass",
    nodes: [uvNode, probeNode],
    inputs: [],
    outputs: [],
    properties: [],
  } as any;

  const vertexPass = {
    id: 5,
    type: "vertex_pass",
    nodes: [],
    inputs: [],
    outputs: [],
    properties: [],
  } as any;

  const surface = {
    id: 1,
    type: "surface",
    nodes: [vertexPass, fragmentPass],
    inputs: [],
    outputs: [],
    properties: [],
  } as any;

  const graph = { type: "", name: "Test", nodes: [surface], inputs: [], outputs: [] } as any;

  const result = buildProbeGraph(graph, 30, { pinId: 0 });
  console.log(result.kind);
  if (result.kind === "ready") {
    const lang = await loadLanguage("ThreeJS_GLSL.json");
    const compiler = new GraphCompiler(result.graph as any, lang as any);
    compiler.compile();
    console.log(compiler.result_code);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
