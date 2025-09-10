import type { Graph } from "../graph/types";
import { graphToMaterialX } from "../io/materialx";

// Lazy-load and initialize the MaterialX WebAssembly module from the official CDN.
// This avoids bundler resolution issues for the WASM assets in local environments.
async function getMaterialX() {
  const base = "https://cdn.jsdelivr.net/npm/@needle-tools/materialx@1.3.2/bin/";
  const MaterialX = await import(
    /* @vite-ignore */ `${base}JsMaterialXGenShader.js`
  ).then((m: any) => m.default || m);
  const module = await MaterialX({
    locateFile: (path: string) => base + path,
  });
  const generator = module.EsslShaderGenerator.create();
  const context = new module.GenContext(generator);
  const stdlib = module.loadStandardLibraries(context);
  context.getOptions().shaderInterfaceType =
    module.ShaderInterfaceType.SHADER_INTERFACE_COMPLETE;
  context.getOptions().hwSpecularEnvironmentMethod =
    module.HwSpecularEnvironmentMethod.SPECULAR_ENVIRONMENT_FIS;
  context.getOptions().hwSrgbEncodeOutput = false;
  context.getOptions().hwMaxActiveLightSources = 4;
  return { module, generator, context, stdlib };
}

let mxPromise: Promise<ReturnType<typeof getMaterialX>> | null = null;
async function ensureMaterialX() {
  return (mxPromise ??= getMaterialX());
}

// Compile a graph to GLSL using the MaterialX WebAssembly build when running in a
// browser environment. Falls back to the template-based GraphCompiler on the server
// or if the MaterialX module fails to load.
export async function compileToGLSL(graph: Graph): Promise<string> {
  try {
    if (typeof window !== "undefined") {
      const { module, generator, context, stdlib } = await ensureMaterialX();
      const mtlx = graphToMaterialX(graph);
      const doc = module.createDocument();
      module.readFromXmlString(doc, mtlx);
      doc.setDataLibrary(stdlib);
      const mats = doc.getMaterialNodes();
      if (mats.length > 0) {
        const material = mats[0];
        const name = material.getNamePath();
        const shader = generator.generate(name, material, context);
        const frag = String(shader.getSourceCode("pixel") || "");
        if (frag) return frag;
      }
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
