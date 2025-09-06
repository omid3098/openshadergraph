import { describe, it, expect } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { validateNodeTemplate, validateLanguagePack } from "../src/core/schema/validators";

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
});
