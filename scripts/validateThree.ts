import { chromium } from "@playwright/test";
import { loadLanguage } from "../src/core/schema/registry";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import type { Graph } from "../src/core/graph/types";
import { ensureSurface, readExampleGraphs } from "./exampleGraphs";
import { buildNodeHarnessGraphs } from "../src/core/testing/nodeHarnessCatalog";

function log(msg: string) {
  console.log(`[validate:three] ${msg}`);
}

function warn(msg: string) {
  console.warn(`[validate:three] ${msg}`);
}

type CompileResult = {
  success: boolean;
  log: string;
};

function stripVertexPass(code: string): string {
  return code.replace(/\/\/ __VERTEX_PASS_BEGIN__[\s\S]*?\/\/ __VERTEX_PASS_END__/g, "");
}

function prepareFragmentSource(code: string): string {
  const withoutVertex = stripVertexPass(code);
  const sanitized = withoutVertex
    .replace(/uniform\s+([^;=]+?)\s*=\s*[^;]+;/g, "uniform $1;")
    .replace(/uniform\s+uniform/g, "uniform");
  const stub = `
#ifndef OSG_THREE_FRAGMENT_STUBS
#define OSG_THREE_FRAGMENT_STUBS
precision highp float;
precision highp int;
#ifndef dFdx
#define dFdx(x) ((x) * 0.0)
#define dFdy(x) ((x) * 0.0)
#define fwidth(x) ((x) * 0.0)
#endif
#ifndef vColor
varying vec4 vColor;
#endif
#ifndef COLOR
#define COLOR vColor
#endif
#ifndef NORMAL
#define NORMAL vNormal
#endif
#ifndef cameraPosition
uniform vec3 cameraPosition;
#endif
#ifndef modelMatrix
uniform mat4 modelMatrix;
#endif
#ifndef viewMatrix
uniform mat4 viewMatrix;
#endif
#ifndef projectionMatrix
uniform mat4 projectionMatrix;
#endif
#ifndef normalMatrix
uniform mat3 normalMatrix;
#endif
#ifndef gl_InstanceID
#define gl_InstanceID 0
#endif
#ifndef sampler2DArray
#define sampler2DArray sampler2D
#endif
#ifndef sampler3D
#define sampler3D sampler2D
#endif
#ifndef textureLod
#define textureLod(s, coord, lod) texture2D((s), (coord).xy)
#endif
#endif // OSG_THREE_FRAGMENT_STUBS
`;
  return `${stub}\n${sanitized}`;
}

async function compileShaderInPage(page: import("@playwright/test").Page, source: string): Promise<CompileResult> {
  return await page.evaluate<CompileResult, string>((code) => {
    const canvas = document.createElement("canvas");
    // cast to any because TypeScript DOM types may not include all WebGL overloads in this
    // script execution environment. The runtime (Playwright) will provide a WebGLRenderingContext.
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as any;
    if (!gl) {
      return { success: false, log: "WebGL context unavailable" };
    }
    if (gl.getExtension) {
      gl.getExtension("OES_standard_derivatives");
      gl.getExtension("EXT_shader_texture_lod");
      gl.getExtension("EXT_color_buffer_float");
    }
    const shader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!shader) return { success: false, log: "Failed to create shader" };
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    const infoLog = gl.getShaderInfoLog(shader) ?? "";
    gl.deleteShader(shader);
    return { success, log: infoLog };
  }, source);
}

async function main() {
  try {
    const graphs = await readExampleGraphs(warn);
    log(`Loaded ${graphs.length} example graphs.`);

    const harnessGraphs = buildNodeHarnessGraphs();
    log(`Built ${harnessGraphs.length} node harness graphs.`);

    const language = await loadLanguage("ThreeJS_GLSL");
    log(`Loaded language pack: ${language.name ?? "ThreeJS_GLSL"}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("data:text/html,<html><body></body></html>");

    const failures: Array<{ key: string; message: string }> = [];

    const compileGraph = async (key: string, graph: Graph) => {
      const surface = ensureSurface(graph);
      const compiler = new GraphCompiler(surface, language);
      compiler.compile();
      const code = compiler.result_code;
      const fragmentSource = prepareFragmentSource(code);
      const { success, log: infoLog } = await compileShaderInPage(page, fragmentSource);
      if (!success) {
        throw new Error(infoLog.trim() || "Shader compilation failed");
      }
    };

    for (const { key, graph } of graphs) {
      try {
        await compileGraph(key, graph);
        log(`✔ ${key}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ key, message });
        warn(`✖ ${key}: ${message}`);
      }
    }

    for (const { key, graph } of harnessGraphs) {
      try {
        await compileGraph(key, graph);
        log(`✔ ${key}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ key, message });
        warn(`✖ ${key}: ${message}`);
      }
    }

    await browser.close();

    if (failures.length) {
      warn(`ThreeJS GLSL validation failed for ${failures.length} graph(s).`);
      for (const failure of failures) {
        warn(` - ${failure.key}: ${failure.message}`);
      }
      process.exitCode = 1;
      return;
    }

    log("All ThreeJS GLSL shaders compiled successfully.");
  } catch (err) {
    if (err instanceof Error && err.message.includes("Please install Playwright browsers")) {
      console.error(
        "[validate:three] Playwright Chromium is missing. Run 'bun run test:e2e:install' once to install the browser bundle."
      );
    } else {
      const message = err instanceof Error ? err.stack ?? err.message : String(err);
      console.error(`[validate:three] Fatal error: ${message}`);
    }
    process.exitCode = 1;
  }
}

await main();
