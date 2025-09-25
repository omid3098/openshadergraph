import { describe, it, expect } from "vitest";
import { promises as fs } from "fs";
import path from "path";

const FORBIDDEN_UNIFORMS = [
  /^uKey/i,
  /^uFill/i,
  /^uRim/i,
  /^uAmbient$/i,
  /^uExposure$/i,
];

describe("language packs must not include preview environment uniforms", () => {
  it("scans data/languages/*.json for forbidden preview uniforms", async () => {
    const dir = path.resolve(process.cwd(), "data", "languages");
    const entries = await fs.readdir(dir);
    const files = entries.filter((f) => f.endsWith(".json"));
    const problems: Array<{ file: string; uniform: string; location?: string }> = [];

    for (const file of files) {
      const abs = path.join(dir, file);
      const raw = await fs.readFile(abs, "utf8");
      const json = JSON.parse(raw);
      const scan = (value: unknown) => {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) {
          value.forEach(scan);
          return;
        }
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          // key name might be a uniform name or code chunk containing it
          for (const re of FORBIDDEN_UNIFORMS) {
            if (re.test(k)) problems.push({ file, uniform: k });
          }
          if (typeof v === "string") {
            for (const re of FORBIDDEN_UNIFORMS) {
              const m = v.match(re);
              if (m) problems.push({ file, uniform: m[0], location: `value` });
            }
          } else if (v && typeof v === "object") {
            scan(v);
          }
        }
      };
      scan(json);
    }

    if (problems.length) {
      const msg = problems.map((p) => `${p.file}: ${p.uniform}${p.location ? ` (${p.location})` : ""}`).join("\n");
      throw new Error(`Forbidden preview uniforms found in language packs:\n${msg}`);
    }

    expect(problems.length).toBe(0);
  });
});


