import { promises as fs, readFileSync } from "fs";
import path from "path";
import type { LanguagePack, NodeTemplate } from "./types";
import { validateLanguagePack, validateNodeTemplate } from "./validators";

const NODE_ROOT = path.resolve(process.cwd(), "data", "nodes");
const LANG_ROOT = path.resolve(process.cwd(), "data", "languages");

let templatesLoaded = false;
const templateMap = new Map<string, NodeTemplate>();

function loadTemplatesSyncOnce() {
  if (templatesLoaded) return;
  // Walk directories under NODE_ROOT and collect .json files
  function walk(dir: string, prefix = "") {
    const entries = require("fs").readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const rel = path.join(prefix, e.name);
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs, rel);
      else if (e.isFile() && e.name.endsWith(".json")) {
        try {
          const raw = readFileSync(abs, "utf8");
          const json = JSON.parse(raw);
          // Ignore base/skeleton files that don't define a concrete node type
          if (!json || typeof json.type !== "string" || json.type.length === 0) continue;
          const valid = validateNodeTemplate(json);
          if (valid && typeof valid.type === "string" && valid.type) {
            templateMap.set(valid.type, valid);
          }
        } catch (err) {
          console.warn("Failed to parse node template:", rel, err);
        }
      }
    }
  }
  walk(NODE_ROOT);
  // Synthetic 'surface' container if missing
  if (!templateMap.has("surface")) {
    templateMap.set("surface", {
      type: "surface",
      name: "Surface",
      meta: [],
      position: [0, 0],
      nodes: [{ type: "vertex_pass" }, { type: "fragment_pass" }],
      inputs: [],
      outputs: [],
    });
  }
  templatesLoaded = true;
}

export function getNodeTemplate(type: string): NodeTemplate | undefined {
  loadTemplatesSyncOnce();
  return templateMap.get(type);
}

export async function loadLanguage(nameOrPath: string): Promise<LanguagePack> {
  let abs = nameOrPath;
  if (!path.isAbsolute(abs)) {
    if (!abs.endsWith(".json")) abs = `${abs}.json`;
    abs = path.join(LANG_ROOT, abs);
  }
  const raw = await fs.readFile(abs, "utf8");
  const parsed = JSON.parse(raw);
  return validateLanguagePack(parsed);
}
