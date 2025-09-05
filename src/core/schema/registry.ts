import { promises as fs, readFileSync } from "fs";
import path from "path";
import type { GraphNode, LanguagePack } from "../graph/types";

export type NodeTemplate = Omit<GraphNode, "id" | "nodes" | "inputs" | "outputs"> & {
  id?: number;
  nodes?: Array<{ type: string }>;
  inputs?: Array<{ id?: number; name: string; type: any; value?: any }>;
  outputs?: Array<{ id?: number; name: string; type: any }>;
};

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
          const json = JSON.parse(raw) as NodeTemplate;
          if (json && typeof json.type === "string" && json.type) {
            templateMap.set(json.type, json);
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
  return JSON.parse(raw) as LanguagePack;
}
