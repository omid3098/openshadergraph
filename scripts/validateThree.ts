import { chromium } from "@playwright/test";
import { loadLanguage } from "../src/core/schema/registry";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import { ensureSurface, readExampleGraphs } from "./exampleGraphs";

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
  return withoutVertex.replace(/uniform\s+([^;=]+?)\s*=\s*[^;]+;/g, "uniform $1;");
}

async function compileShaderInPage(page: import("@playwright/test").Page, source: string): Promise<CompileResult> {
  return await page.evaluate<CompileResult, string>((code) => {
    const canvas = document.createElement("canvas");
    // cast to any because TypeScript DOM types may not include all WebGL overloads in this
    // script execution environment. The runtime (Playwright) will provide a WebGLRenderingContext.
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as any;
    if (!gl) {
      return { success: false, log: "WebGL context unavailable" };
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

    const language = await loadLanguage("ThreeJS_GLSL");
    log(`Loaded language pack: ${language.name ?? "ThreeJS_GLSL"}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("data:text/html,<html><body></body></html>");

    const failures: Array<{ key: string; message: string }> = [];

    for (const { key, graph } of graphs) {
      const surface = ensureSurface(graph);
      try {
        const compiler = new GraphCompiler(surface, language);
        compiler.compile();
        const code = compiler.result_code;
        const fragmentSource = prepareFragmentSource(code);
        const { success, log: infoLog } = await compileShaderInPage(page, fragmentSource);
        if (!success) {
          throw new Error(infoLog.trim() || "Shader compilation failed");
        }
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
