import { promises as fs, readFileSync } from "fs";
import path from "path";
import type { LanguagePack, NodeTemplate } from "./types";
import { validateLanguagePack, validateNodeTemplate } from "./validators";

function resolveExistingPath(paths: string[]): string {
  for (const p of paths) {
    try {
      const s = require("fs").statSync(p);
      if (s && (s.isDirectory() || s.isFile())) return p;
    } catch {}
  }
  return paths[0]!;
}

const DATA_ROOT: string = resolveExistingPath([
  path.resolve(process.cwd(), "data"),
  path.resolve(process.cwd(), "dist", "data"),
]);
const NODE_ROOT: string = path.join(DATA_ROOT, "nodes");
const LANG_ROOT: string = path.join(DATA_ROOT, "languages");

let templatesLoaded = false;
const templateMap = new Map<string, NodeTemplate>();

// Browser loaders removed: we rely on server-side API only

function loadTemplatesSyncOnce() {
  if (templatesLoaded) return;
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
          if (!json || typeof json.type !== "string" || json.type.length === 0) continue;
          const valid = validateNodeTemplate(json);
          if (Array.isArray(valid.properties)) {
            valid.properties = valid.properties.map((prop) =>
              prop && typeof prop === "object" && (prop as any).default !== undefined && (prop as any).value === undefined
                ? { ...(prop as any), value: (prop as any).default }
                : prop
            );
          } else {
            valid.properties = [] as any;
          }
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
  if (!templateMap.has("surface")) {
    templateMap.set("surface", {
      type: "surface",
      name: "Surface",
      meta: [],
      position: [0, 0],
      nodes: [{ type: "vertex_pass" }, { type: "fragment_pass" }],
      inputs: [],
      outputs: [],
    } as any);
  }
  templatesLoaded = true;
}

export function getNodeTemplate(type: string): NodeTemplate | undefined {
  // Do not force-load in browser; rely on preloader and return undefined if missing
  if (!templatesLoaded) loadTemplatesSyncOnce();
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
