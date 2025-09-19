import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { promises as fs, rmSync } from "fs";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import { loadLanguage } from "../src/core/schema/registry";
import { basic_color_graph, addition_graph, float_graph, full_fragment_graph, exposed_addition_graph } from "./graph_samples";

const ROOT = process.cwd();
const SHADERS_DIR = path.join(ROOT, "tests", "shaders");

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

function extractFunctionBody(code: string, fnName: string): string[] {
  const startRe = new RegExp(`^\\s*void\\s+${fnName}\\(\\) \\{`, "m");
  const start = code.match(startRe)?.index ?? -1;
  if (start === -1) return [];
  // Find the brace range from this start
  const after = code.slice(start);
  const openIndex = after.indexOf("{");
  let depth = 0;
  let endOffset = -1;
  for (let i = openIndex; i < after.length; i++) {
    const ch = after[i];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) { endOffset = i; break; }
    }
  }
  if (endOffset === -1) return [];
  const body = after.slice(openIndex + 1, endOffset);
  return body.split("\n");
}

function expectCleanIndentation(shader: string) {
  // Top-level anchors are never indented
  expect(shader).not.toMatch(/^\t+shader_type\b/m);
  expect(shader).not.toMatch(/^\t+render_mode\b/m);
  expect(shader).not.toMatch(/^\t+uniform\b/m);

  for (const fn of ["vertex", "fragment"]) {
    const bodyLines = extractFunctionBody(shader, fn);
    if (bodyLines.length === 0) continue;
    for (const line of bodyLines) {
      const trimmed = line.trim();
      if (!trimmed) continue; // allow blank lines
      // Inside function bodies: exactly 1 tab indent, not 2+
      expect(line.startsWith("\t")).toBe(true);
      expect(line.startsWith("\t\t")).toBe(false);
      // No trailing whitespace on non-empty lines
      expect(/\s$/.test(line)).toBe(false);
    }
  }
}

describe("Shader formatting: indentation hygiene", () => {
  beforeAll(() => {
    try {
      rmSync(SHADERS_DIR, { recursive: true, force: true });
    } catch (err) {
      // Ignore transient ENOTEMPTY from parallel writers; tests will still proceed
    }
  });

  it("float → roughness assigns with single indent", async () => {
    const { surface } = float_graph();
    const code = await compile_graph(surface.to_dict(), "Godot.json", "float_graph");
    // Specific regression: ROUGHNESS assignment must have exactly one tab
    expect(code).toMatch(/^\tROUGHNESS\s*=\s*float_\d+;/m);
    // General indentation rules inside functions
    expectCleanIndentation(code);
  });

  it("basic color and addition respect single-indent inside fragment", async () => {
    const { surface: s1 } = basic_color_graph();
    const code1 = await compile_graph(s1.to_dict(), "Godot.json", "basic_color");
    expectCleanIndentation(code1);

    const { surface: s2 } = addition_graph();
    const code2 = await compile_graph(s2.to_dict(), "Godot.json", "addition");
    expectCleanIndentation(code2);
  });

  it("full fragment output all properties single-indented", async () => {
    const { surface } = full_fragment_graph();
    const code = await compile_graph(surface.to_dict(), "Godot.json", "fragment_features");
    for (const prop of ["ALBEDO", "ROUGHNESS", "METALLIC", "EMISSION", "NORMAL", "ALPHA"]) {
      const re = new RegExp(`^\\t${prop}\\s*=`, "m");
      expect(re.test(code)).toBe(true);
      const reDouble = new RegExp(`^\\t\\t${prop}\\s*=`, "m");
      expect(reDouble.test(code)).toBe(false);
    }
    expectCleanIndentation(code);
  });

  it("exposed uniforms remain top-level and unindented", async () => {
    const { surface } = exposed_addition_graph();
    const code = await compile_graph(surface.to_dict(), "Godot.json", "exposed");
    // uniforms should not be prefixed by tabs
    expect(code).not.toMatch(/^\tuniform\b/m);
    expectCleanIndentation(code);
  });
});

