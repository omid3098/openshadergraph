import { promises as fs, readFileSync } from "fs";
import path from "path";
import type { LanguagePack, NodeTemplate } from "./types";
import { validateLanguagePack, validateNodeTemplate } from "./validators";

const IS_BROWSER = typeof window !== "undefined";
const OSG_STATIC_BUNDLES = (globalThis as any)?.process?.env?.OSG_STATIC_BUNDLES === "1" ||
  (typeof window !== "undefined" && (window as any).OSG_STATIC_BUNDLES === "1") ||
  (typeof location !== "undefined" && location.hostname.endsWith(".pages.dev"));
const NODE_ROOT: string = IS_BROWSER ? "/data/nodes" : path.resolve(process.cwd(), "data", "nodes");
const LANG_ROOT: string = IS_BROWSER ? "/data/languages" : path.resolve(process.cwd(), "data", "languages");

let templatesLoaded = false;
const templateMap = new Map<string, NodeTemplate>();

async function loadTemplatesBrowserOnce(): Promise<void> {
  if (templatesLoaded) return;
  if (typeof window === "undefined" || typeof fetch === "undefined") return;
  // Try manifest + bundle first (or force when static bundles flag is on)
  try {
    let bundleName: string | null = null;
    let fastPath = false;
    try {
      const manRes = await fetch("/data/manifest.json");
      if (manRes.ok) {
        const manifest = await manRes.json();
        const hashed = Object.keys(manifest as any).find((k) => k.startsWith("nodes.bundle.") && k.endsWith(".json"));
        bundleName = hashed ?? "nodes.bundle.json";
        // If manifest exists, we consider content prevalidated in build → skip heavy zod parse
        fastPath = true;
      }
    } catch {}
    const bundlePath = `/data/${bundleName ?? "nodes.bundle.json"}`;
    const bRes = await fetch(bundlePath);
    if (bRes.ok) {
      const bJson: any = await bRes.json();
      const dict = (bJson && typeof bJson === "object" ? (bJson.nodes ?? {}) : {}) as Record<string, unknown>;
      for (const _rel in dict) {
        try {
          const raw = (dict as any)[_rel];
          const tpl: any = fastPath ? raw : validateNodeTemplate(raw);
          if (Array.isArray(tpl.properties)) {
            tpl.properties = tpl.properties.map((prop: any) =>
              prop && typeof prop === "object" && (prop as any).default !== undefined && (prop as any).value === undefined
                ? { ...(prop as any), value: (prop as any).default }
                : prop
            );
          } else {
            tpl.properties = [] as any;
          }
          if (tpl && typeof tpl.type === "string" && tpl.type) templateMap.set(tpl.type, tpl as any);
        } catch {}
      }
      templatesLoaded = true;
      return;
    }
  } catch {}
  // Fallback: index + per-file fetches (skip when explicitly forcing bundles)
  if (OSG_STATIC_BUNDLES) {
    templatesLoaded = true;
    return;
  }
  try {
    const indexRes = await fetch("/data/nodes.index.json");
    if (!indexRes.ok) { templatesLoaded = true; return; }
    const indexJson: any = await indexRes.json();
    const flat: Array<{ path: string }> = Array.isArray(indexJson?.flat) ? indexJson.flat : [];
    for (const item of flat) {
      const p = String(item?.path ?? "");
      if (!p) continue;
      try {
        const tplRes = await fetch(`/data/nodes/${p}`);
        if (!tplRes.ok) continue;
        const json = await tplRes.json();
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
        if (valid && typeof valid.type === "string" && valid.type) templateMap.set(valid.type, valid);
      } catch {}
    }
  } catch {}
  templatesLoaded = true;
}

export async function loadAllTemplatesForBrowser(): Promise<void> {
  if (templatesLoaded) return;
  await loadTemplatesBrowserOnce();
}

function loadTemplatesSyncOnce() {
  if (templatesLoaded) return;
  if (typeof window !== "undefined") {
    // In browser, caller must await loadAllTemplatesForBrowser(); do not mark as loaded here.
    return;
  }
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
  if (!templatesLoaded && typeof window === "undefined") loadTemplatesSyncOnce();
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

// Browser helper: load language pack via bundle when possible
export async function loadLanguageForBrowser(key: string): Promise<LanguagePack> {
  if (typeof window === "undefined" || typeof fetch === "undefined") {
    return loadLanguage(key);
  }
  // Try manifest + languages bundle (or force when static bundles flag is on)
  try {
    let bundleName: string | null = null;
    try {
      const manRes = await fetch("/data/manifest.json");
      if (manRes.ok) {
        const manifest = await manRes.json();
        const hashed = Object.keys(manifest as any).find((k) => k.startsWith("languages.bundle.") && k.endsWith(".json"));
        bundleName = hashed ?? "languages.bundle.json";
      }
    } catch {}
    const bundlePath = `/data/${bundleName ?? "languages.bundle.json"}`;
    const res = await fetch(bundlePath);
    if (res.ok) {
      const bJson: any = await res.json();
      const dict = (bJson && typeof bJson === "object" ? (bJson.languages ?? {}) : {}) as Record<string, unknown>;
      const pack = dict[key] as any;
      if (pack) return validateLanguagePack(pack);
    }
  } catch {}
  // Fallback: direct static file (skip when explicitly forcing bundles)
  if (OSG_STATIC_BUNDLES) {
    throw new Error(`Language '${key}' not found in bundle`);
  }
  try {
    const res2 = await fetch(`/data/languages/${key}.json`);
    if (res2.ok) return validateLanguagePack(await res2.json());
  } catch {}
  throw new Error(`Language '${key}' not found`);
}
