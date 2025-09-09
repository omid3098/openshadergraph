import type { Graph } from "../graph/types";
import { graphToMaterialX } from "../io/materialx";

// Compile a graph to GLSL using MaterialX WebAssembly bindings when running in
// a browser environment. Falls back to the existing template-based GraphCompiler
// on the server or when the MaterialX module is unavailable.
export async function compileToGLSL(graph: Graph): Promise<string> {
  try {
    if (typeof window !== "undefined") {
      const { ready, Experimental_API } = await import("@needle-tools/materialx");
      await ready();
      const mtlx = graphToMaterialX(graph);
      const mat = await Experimental_API.createMaterialXMaterial(
        mtlx,
        "PreviewMaterial",
        { getTexture: async () => null }
      );
      const frag = String((mat as any).fragmentShader || "");
      if (frag) return frag;
    }
  } catch (err) {
    console.warn("MaterialX compile failed, falling back to template compiler", err);
  }
  const { loadLanguage } = await import("../schema/registry");
  const { GraphCompiler } = await import("./graphCompiler");
  const lang = await loadLanguage("ThreeJS_GLSL");
  const compiler = new GraphCompiler(graph as any, lang);
  compiler.compile();
  return compiler.result_code;
}
