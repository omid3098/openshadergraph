import { describe, it, expect } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { validateNodeTemplate, validateLanguagePack, validateAssetLibrary } from "../src/core/schema/validators";

async function walk(dir: string, cb: (abs: string, rel: string) => Promise<void>) {
  const entries = await fs.readdir(dir, { withFileTypes: true } as any);
  for (const e of entries as any[]) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) await walk(abs, cb);
    else if (e.isFile()) await cb(abs, path.relative(dir, abs));
  }
}

describe("data schema validation", () => {
  it("validates all node templates", async () => {
    const root = path.resolve(process.cwd(), "data", "nodes");
    const files: string[] = [];
    await walk(root, async (abs, rel) => { if (rel.endsWith(".json")) files.push(abs); });
    for (const f of files) {
      const raw = await fs.readFile(f, "utf8");
      const json = JSON.parse(raw);
      // Skip skeleton or base files with empty type fields
      if (!json || typeof json.type !== "string" || json.type.length === 0) continue;
      expect(() => validateNodeTemplate(json)).not.toThrow();
    }
  });

  it("validates all language packs", async () => {
    const root = path.resolve(process.cwd(), "data", "languages");
    const files: string[] = [];
    await walk(root, async (abs, rel) => { if (rel.endsWith(".json")) files.push(abs); });
    for (const f of files) {
      const raw = await fs.readFile(f, "utf8");
      const json = JSON.parse(raw);
      expect(() => validateLanguagePack(json)).not.toThrow();
    }
  });

  it("validates the asset library", async () => {
    const file = path.resolve(process.cwd(), "data", "assets", "library.json");
    const raw = await fs.readFile(file, "utf8");
    const json = JSON.parse(raw);
    expect(() => validateAssetLibrary(json)).not.toThrow();
  });

  it("ensures every node type has templates across languages", async () => {
    const nodeRoot = path.resolve(process.cwd(), "data", "nodes");
    const nodeTypes = new Set<string>();
    const nodeTemplates: Record<string, any> = {};
    await walk(nodeRoot, async (abs, rel) => {
      if (!rel.endsWith(".json")) return;
      const raw = await fs.readFile(abs, "utf8");
      const json = JSON.parse(raw);
      const t = typeof json.type === "string" ? json.type.trim() : "";
      if (!t) return;
      nodeTypes.add(t);
      nodeTemplates[t] = validateNodeTemplate(json);
    });

    const langRoot = path.resolve(process.cwd(), "data", "languages");
    const languageFiles: string[] = [];
    await walk(langRoot, async (abs, rel) => { if (rel.endsWith(".json")) languageFiles.push(abs); });
    for (const file of languageFiles) {
      const raw = await fs.readFile(file, "utf8");
      const lang = JSON.parse(raw);
      const nodes = lang?.nodes ?? {};
      const missing: string[] = [];
      for (const type of nodeTypes) {
        if (!nodes[type] || typeof nodes[type].template !== "string" || nodes[type].template.length === 0) {
          missing.push(type);
        }
      }
      if (missing.length) {
        throw new Error(`Language '${lang?.name ?? path.basename(file)}' missing templates for: ${missing.join(", ")}`);
      }
    }

    for (const file of languageFiles) {
      const raw = await fs.readFile(file, "utf8");
      const lang = JSON.parse(raw);
      const nodes = lang?.nodes ?? {};
      const missingProps: string[] = [];
      for (const type of Object.keys(nodeTemplates)) {
        const template = nodeTemplates[type];
        const properties: any[] = Array.isArray(template?.properties) ? template.properties : [];
        if (!properties.length) continue;
        const langNode = nodes[type];
        for (const prop of properties) {
          if (!prop || typeof prop !== "object" || prop.type !== "enum") continue;
          const options: any[] = Array.isArray(prop.options) ? prop.options : [];
          for (const opt of options) {
            const token = opt?.langKey ?? opt?.value;
            if (!token) continue;
            const resolved = langNode?.properties?.[prop.id]?.[String(token)]?.template;
            if (typeof resolved !== "string") {
              missingProps.push(`${type}.${prop.id}.${token}`);
            }
          }
        }
      }
      if (missingProps.length) {
        throw new Error(
          `Language '${lang?.name ?? path.basename(file)}' missing property templates for: ${missingProps.join(", ")}`
        );
      }
    }
  });
});
