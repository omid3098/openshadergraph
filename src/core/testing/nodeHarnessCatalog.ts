import type { Graph } from "@/core/graph/types";
import type { NodeTemplate } from "@/core/schema/types";
import { listNodeTemplates } from "@/core/schema/registry";
import { buildNodeHarness, canonicalizeTypeName, type NodeHarnessOptions } from "./nodeHarness";
import { normalizePinType } from "@/core/types/pinTypes";

export type NodeHarnessCatalogEntry = {
  type: string;
  options?: NodeHarnessOptions;
  skip?: boolean;
  reason?: string;
};

export type NodeHarnessGraphEntry = {
  key: string;
  graph: Graph;
};

const STATIC_OVERRIDES: Record<string, Partial<NodeHarnessCatalogEntry>> = {
  surface: { skip: true, reason: "surface is the root container" },
  vertex_pass: { skip: true, reason: "vertex pass cannot run standalone" },
  fragment_pass: { skip: true, reason: "fragment pass renders nested nodes only" },
  fragment_output: { skip: true, reason: "fragment output is the graph sink" },
  vertex_output: { skip: true, reason: "vertex output is the graph sink" },
  editor_probe: { skip: true, reason: "editor-only instrumentation" },
  editor_assets: { skip: true, reason: "editor-only instrumentation" },
  editor_graph_data: { skip: true, reason: "editor-only instrumentation" },
  editor_compile: { skip: true, reason: "editor-only instrumentation" },
  editor_note: { skip: true, reason: "editor-only instrumentation" },
  texture: { skip: true, reason: "sampler providers require a consumer fixture" },
  texture3d: { skip: true, reason: "sampler providers require a consumer fixture" },
  texture_cube: { skip: true, reason: "sampler providers require a consumer fixture" },
  texture_array: { skip: true, reason: "sampler providers require a consumer fixture" },
};

const EDITOR_PREFIX = "editor_";

export function getNodeHarnessCatalog(): NodeHarnessCatalogEntry[] {
  const templates = listNodeTemplates();
  const catalog: NodeHarnessCatalogEntry[] = templates.map((template) => buildCatalogEntry(template));
  catalog.sort((a, b) => a.type.localeCompare(b.type));
  return catalog;
}

function buildCatalogEntry(template: NodeTemplate): NodeHarnessCatalogEntry {
  const override = STATIC_OVERRIDES[template.type];
  const entry: NodeHarnessCatalogEntry = {
    type: template.type,
    options: override?.options,
    skip: override?.skip,
    reason: override?.reason,
  };

  if (entry.skip === true) {
    return entry;
  }

  if (template.type.startsWith(EDITOR_PREFIX)) {
    entry.skip = true;
    entry.reason = entry.reason ?? "editor-only template";
    return entry;
  }

  const outputs = Array.isArray(template.outputs) ? template.outputs : [];
  if (outputs.length === 0) {
    entry.skip = true;
    entry.reason = entry.reason ?? "template has no outputs";
    return entry;
  }

  const samplerOnly = outputs.every((output) => {
    const normalized = canonicalizeTypeName(normalizePinType(output.type));
    return typeof normalized === "string" && normalized.startsWith("sampler");
  });
  if (samplerOnly) {
    entry.skip = true;
    entry.reason = entry.reason ?? "sampler-only output requires consumer fixture";
    return entry;
  }

  return entry;
}

export function buildNodeHarnessGraphs(): NodeHarnessGraphEntry[] {
  const entries = getNodeHarnessCatalog();
  const result: NodeHarnessGraphEntry[] = [];
  for (const entry of entries) {
    if (entry.skip) continue;
    const harness = buildNodeHarness(entry.type, entry.options);
    result.push({ key: `node:${entry.type}`, graph: harness.surface });
  }
  return result;
}
