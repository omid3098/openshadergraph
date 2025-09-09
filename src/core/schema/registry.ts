import { promises as fs, readFileSync, readdirSync } from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";
import type { LanguagePack, NodeTemplate } from "./types";
import { validateLanguagePack } from "./validators";

const MATERIALX_ROOT = path.resolve(process.cwd(), "data", "materialx");
const LANG_ROOT = path.resolve(process.cwd(), "data", "languages");

let templatesLoaded = false;
const templateMap = new Map<string, NodeTemplate>();
const dataTypes: string[] = [];

function loadTemplatesSyncOnce() {
  if (templatesLoaded) return;
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
  const files = readdirSync(MATERIALX_ROOT).filter((f) => f.endsWith(".mtlx"));
  for (const file of files) {
    try {
      const raw = readFileSync(path.join(MATERIALX_ROOT, file), "utf8");
      const doc = parser.parse(raw);
      const defs = doc.materialx?.nodedef;
      const typedefs = doc.materialx?.typedef;
      if (typedefs) {
        const arr = Array.isArray(typedefs) ? typedefs : [typedefs];
        for (const td of arr) if (td?.name) dataTypes.push(td.name);
      }
      if (!defs) continue;
      const arr = Array.isArray(defs) ? defs : [defs];
      for (const nd of arr) {
        const inputs = Array.isArray(nd.input) ? nd.input : nd.input ? [nd.input] : [];
        const outputs = Array.isArray(nd.output) ? nd.output : nd.output ? [nd.output] : [];
        const tmpl: NodeTemplate = {
          type: nd.name ?? nd.node ?? "",
          name: nd.node ?? nd.name ?? "",
          meta: [],
          nodes: [],
          inputs: inputs.map((inp: any, i: number) => ({
            id: i,
            name: inp.name ?? `in${i}`,
            type: inp.type ?? "float",
            value: inp.value,
          })),
          outputs: outputs.map((out: any, i: number) => ({
            id: i,
            name: out.name ?? `out${i}`,
            type: out.type ?? "float",
          })),
        };
        if (tmpl.type) templateMap.set(tmpl.type, tmpl);
      }
    } catch (err) {
      console.warn("Failed to parse MaterialX file", file, err);
    }
  }
  // Synthetic grouping nodes for editor features
  templateMap.set("group", {
    type: "group",
    name: "Group",
    meta: [],
    position: [0, 0],
    nodes: [{ type: "group_input" }, { type: "group_output" }],
    inputs: [],
    outputs: [],
  });
  templateMap.set("group_input", {
    type: "group_input",
    name: "Group Input",
    meta: [],
    nodes: [],
    inputs: [],
    outputs: [{ id: 0, name: "out", type: "float" }],
  });
  templateMap.set("group_output", {
    type: "group_output",
    name: "Group Output",
    meta: [],
    nodes: [],
    inputs: [{ id: 0, name: "in", type: "float" }],
    outputs: [],
  });
  templatesLoaded = true;
}

export function getNodeTemplate(type: string): NodeTemplate | undefined {
  loadTemplatesSyncOnce();
  return templateMap.get(type);
}

export function getDataTypes(): string[] {
  loadTemplatesSyncOnce();
  return [...dataTypes];
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

