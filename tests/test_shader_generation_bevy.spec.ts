import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs, rmSync } from "fs";
import path from "path";
import { basic_color_graph, addition_graph } from "./graph_samples";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import { loadLanguage } from "../src/core/schema/registry";

const ROOT = process.cwd();
const SHADERS_DIR = path.join(ROOT, "tests", "shaders");
const ENGINE_DIR = path.join(SHADERS_DIR, "bevy_wgsl");

async function compile_graph(graph: any, languageFile: string, name = "shader") {
  const lang = await loadLanguage(languageFile.endsWith(".json") ? languageFile : `${languageFile}`);
  const compiler = new GraphCompiler(graph, lang);
  compiler.compile();
  const ext = lang.file_extensions[0];
  const engine = path.parse(languageFile).name.toLowerCase();
  const out_dir = path.join(SHADERS_DIR, engine);
  await fs.mkdir(out_dir, { recursive: true });
  const out_file = path.join(out_dir, `${name}.${ext}`);
  await fs.writeFile(out_file, compiler.result_code, "utf8");
  return compiler.result_code;
}

describe("Bevy WGSL shader generation", () => {
  beforeAll(() => {
    rmSync(ENGINE_DIR, { recursive: true, force: true });
  });

  it("basic color shader", async () => {
    const { surface } = basic_color_graph();
    const shader_code = await compile_graph(surface.to_dict(), "Bevy_WGSL.json", "basic_color");
    // Structure
    expect(shader_code).toMatch(/@fragment\s+fn\s+main\s*\(\)\s*->\s*@location\(0\)\s+vec4<f32>\s*\{/);
    expect(shader_code).toMatch(/let\s+color_\d+\s*:\s*vec4<f32>\s*=\s*vec4<f32>\(1.0,\s*1.0,\s*1.0,\s*1.0\)\s*;/);
    // Returns a vec4
    expect(shader_code).toMatch(/return\s+vec4<f32>\(/);
    // No unresolved placeholders
    expect(shader_code).not.toContain("{{property:");
    // File written
    const out_file = path.join(SHADERS_DIR, "bevy_wgsl", "basic_color.wgsl");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });

  it("addition shader", async () => {
    const { surface } = addition_graph();
    const shader_code = await compile_graph(surface.to_dict(), "Bevy_WGSL.json", "addition");
    expect(shader_code).toMatch(/let\s+add_\d+\s*:\s*vec4<f32>\s*=\s*color_\d+\s*\+\s*color_\d+\s*;/);
    const out_file = path.join(SHADERS_DIR, "bevy_wgsl", "addition.wgsl");
    await expect(fs.stat(out_file)).resolves.toBeDefined();
  });
});


