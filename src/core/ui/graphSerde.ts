import type { Edge, Node } from "@xyflow/react";
import type { Graph, GraphNode, InputPin, OutputPin } from "@/core/graph/types";
import type { NodeProperty, NodeTemplate } from "@/core/schema/types";
import { buildGraphData } from "./graphData";

export type SerializedGraphNode = {
  id: number;
  type: string;
  position?: [number, number];
  name?: string;
  meta?: any[];
  nodes?: SerializedGraphNode[];
  inputs?: Array<{ id: number; value?: any }>;
  outputs?: Array<{ id: number; value?: any }>;
  properties?: Array<{ id: string; value?: any } | NodeProperty>;
};

export type SerializedGraph = {
  type?: string;
  name?: string;
  nodes?: SerializedGraphNode[];
};

type TemplateById = Map<number, NodeTemplate>;

const REF_PREFIX = "../";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item)) as unknown as T;
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cloneValue(v)])) as T;
  return value;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return a === b;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!valuesEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!valuesEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

function ensurePinIds(pins: Array<InputPin | OutputPin> | undefined) {
  if (!Array.isArray(pins)) return;
  pins.forEach((pin, index) => {
    if (typeof pin.id !== "number") pin.id = index;
  });
}

function collectDefaults(nodes: Node[]): TemplateById {
  const map: TemplateById = new Map();
  for (const node of nodes) {
    const tpl = (node.data as any)?.templateDefaults as NodeTemplate | undefined;
    if (!tpl) continue;
    const id = Number(node.id);
    if (!Number.isFinite(id)) continue;
    const clone = cloneValue(tpl);
    ensurePinIds(clone.inputs as any);
    ensurePinIds(clone.outputs as any);
    clone.id = id;
    map.set(id, clone);
  }
  return map;
}

function diffPins(pins: InputPin[] | undefined, defaults: InputPin[] | undefined): Array<{ id: number; value?: any }> {
  if (!Array.isArray(pins)) return [];
  const baseMap = new Map<number, InputPin>();
  if (Array.isArray(defaults)) {
    for (const pin of defaults) {
      const id = typeof pin.id === "number" ? pin.id : baseMap.size;
      baseMap.set(id, pin);
    }
  }

  const patches: Array<{ id: number; value?: any }> = [];
  for (let i = 0; i < pins.length; i++) {
    const pin = pins[i];
    const id = typeof pin.id === "number" ? pin.id : i;
    const base = baseMap.get(id);
    const value = pin.value;
    const hasRef = typeof value === "string" && value.startsWith(REF_PREFIX);
    const baseValue = base ? base.value : undefined;
    if (hasRef || !valuesEqual(value, baseValue)) {
      if (value === undefined) continue;
      const entry: { id: number; value?: any } = { id };
      entry.value = cloneValue(value);
      patches.push(entry);
    }
  }
  return patches;
}

function diffProperties(props: NodeProperty[] | undefined, defaults: NodeProperty[] | undefined) {
  const result: Array<{ id: string; value?: any } | NodeProperty> = [];
  const baseMap = new Map<string, NodeProperty>();
  if (Array.isArray(defaults)) {
    for (const prop of defaults) {
      if (!prop || typeof prop !== "object" || typeof prop.id !== "string") continue;
      baseMap.set(prop.id, prop);
    }
  }

  if (!Array.isArray(props)) return result;

  for (const prop of props) {
    if (!prop || typeof prop !== "object" || typeof prop.id !== "string") continue;
    const base = baseMap.get(prop.id);
    if (!base) {
      result.push(cloneValue(prop));
      continue;
    }
    const nextValue = "value" in prop ? (prop as any).value : undefined;
    const baseValue = "value" in base ? (base as any).value : undefined;
    if (!valuesEqual(nextValue, baseValue)) {
      result.push({ id: prop.id, value: cloneValue(nextValue) });
    }
  }

  return result;
}

function pruneNode(node: SerializedGraphNode) {
  if (!node.meta || node.meta.length === 0) delete (node as any).meta;
  if (!node.inputs || node.inputs.length === 0) delete (node as any).inputs;
  if (!node.outputs || node.outputs.length === 0) delete (node as any).outputs;
  if (!node.properties || node.properties.length === 0) delete (node as any).properties;
  if (!node.nodes || node.nodes.length === 0) delete (node as any).nodes;
}

function diffNode(node: GraphNode, defaultsById: TemplateById): SerializedGraphNode {
  const result: SerializedGraphNode = {
    id: node.id,
    type: node.type,
    position: node.position ? cloneValue(node.position) : undefined,
  };

  const defaults = defaultsById.get(node.id);

  if (node.name && (!defaults || node.name !== defaults.name)) {
    result.name = node.name;
  }

  const meta = Array.isArray(node.meta) ? node.meta : [];
  const baseMeta = Array.isArray(defaults?.meta) ? defaults!.meta! : [];
  if (meta.length && (!defaults || !valuesEqual(meta, baseMeta))) {
    result.meta = cloneValue(meta);
  }

  const pinsInputs = diffPins(node.inputs, defaults?.inputs as InputPin[] | undefined);
  if (pinsInputs.length) result.inputs = pinsInputs;

  const pinsOutputs = diffPins(node.outputs as InputPin[] | undefined, defaults?.outputs as InputPin[] | undefined);
  if (pinsOutputs.length) result.outputs = pinsOutputs;

  const propDiff = diffProperties(node.properties as NodeProperty[] | undefined, defaults?.properties as NodeProperty[] | undefined);
  if (propDiff.length) result.properties = propDiff;

  if (Array.isArray(node.nodes) && node.nodes.length) {
    result.nodes = node.nodes.map((child) => diffNode(child, defaultsById));
  }

  pruneNode(result);
  return result;
}

export function serializeGraph(nodes: Node[], edges: Edge[], graphName: string): SerializedGraph {
  const defaults = collectDefaults(nodes);
  const root = buildGraphData(nodes, edges, graphName);
  const serialized: SerializedGraph = {
    type: root.type,
    name: root.name,
    nodes: Array.isArray(root.nodes) ? root.nodes.map((node) => diffNode(node, defaults)) : [],
  };
  if (!serialized.nodes || serialized.nodes.length === 0) delete serialized.nodes;
  if (!serialized.type) delete serialized.type;
  if (!serialized.name) delete serialized.name;
  return serialized;
}

type LoadTemplateFn = (type: string) => Promise<NodeTemplate | undefined>;

function ensureArrays(tpl: NodeTemplate) {
  if (!Array.isArray(tpl.nodes)) tpl.nodes = [];
  if (!Array.isArray(tpl.inputs)) tpl.inputs = [];
  if (!Array.isArray(tpl.outputs)) tpl.outputs = [];
  if (!Array.isArray(tpl.meta)) tpl.meta = [];
  if (!Array.isArray(tpl.properties)) tpl.properties = [];
  ensurePinIds(tpl.inputs as any);
  ensurePinIds(tpl.outputs as any);
}

function toTemplateSkeleton(node: any): NodeTemplate {
  return {
    id: node?.id,
    type: typeof node?.type === "string" ? node.type : "",
    name: typeof node?.name === "string" ? node.name : undefined,
    meta: Array.isArray(node?.meta) ? cloneValue(node.meta) : [],
    position: Array.isArray(node?.position) ? cloneValue(node.position) : [0, 0],
    nodes: [],
    inputs: [],
    outputs: [],
    properties: [],
  };
}

function applyPinPatch(basePins: Array<InputPin | OutputPin>, patchPins: any[]) {
  const map = new Map<number, InputPin | OutputPin>();
  basePins.forEach((pin, idx) => {
    const id = typeof pin.id === "number" ? pin.id : idx;
    pin.id = id;
    map.set(id, pin);
  });
  patchPins.forEach((patch: any, idx: number) => {
    if (!patch || typeof patch !== "object") return;
    const id = typeof patch.id === "number" ? patch.id : idx;
    const target = map.get(id);
    if (target) {
      if ("value" in patch) {
        if (patch.value === undefined) delete (target as any).value;
        else (target as any).value = cloneValue(patch.value);
      }
      if ("name" in patch && typeof patch.name === "string") (target as any).name = patch.name;
      if ("type" in patch && patch.type !== undefined) (target as any).type = patch.type;
    } else {
      const next: any = { id };
      if (patch.name !== undefined) next.name = patch.name;
      if (patch.type !== undefined) next.type = patch.type;
      if (patch.value !== undefined) next.value = cloneValue(patch.value);
      basePins.push(next);
      map.set(id, next);
    }
  });
}

function applyPropertyPatch(base: NodeTemplate, patch: any[]) {
  const map = new Map<string, NodeProperty>();
  (base.properties ?? []).forEach((prop: any) => {
    if (prop && typeof prop.id === "string") map.set(prop.id, prop);
  });
  patch.forEach((entry: any) => {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string") return;
    const current = map.get(entry.id);
    if (current) {
      if ("value" in entry) (current as any).value = cloneValue(entry.value);
      else Object.assign(current, cloneValue(entry));
    } else {
      (base.properties as NodeProperty[]).push(cloneValue(entry));
    }
  });
}

async function inflateNode(raw: any, loadTemplate: LoadTemplateFn, defaults: TemplateById): Promise<GraphNode> {
  const template = (await loadTemplate(raw?.type)) ?? null;
  const base = template ? cloneValue(template) : toTemplateSkeleton(raw);
  ensureArrays(base);
  const defaultsClone = cloneValue(base);

  base.id = typeof raw?.id === "number" ? raw.id : base.id ?? 0;
  base.type = typeof raw?.type === "string" ? raw.type : base.type ?? "";
  if (Array.isArray(raw?.position)) base.position = cloneValue(raw.position);
  if (typeof raw?.name === "string") base.name = raw.name;
  if (Array.isArray(raw?.meta)) base.meta = cloneValue(raw.meta);

  if (Array.isArray(raw?.inputs) && raw.inputs.length) {
    applyPinPatch(base.inputs as any, raw.inputs);
  }
  if (Array.isArray(raw?.outputs) && raw.outputs.length) {
    applyPinPatch(base.outputs as any, raw.outputs);
  }
  if (Array.isArray(raw?.properties) && raw.properties.length) {
    applyPropertyPatch(base, raw.properties);
  }

  const childNodes: GraphNode[] = [];
  const rawChildren = Array.isArray(raw?.nodes) ? raw.nodes : [];
  for (const child of rawChildren) {
    const inflated = await inflateNode(child, loadTemplate, defaults);
    childNodes.push(inflated);
  }
  base.nodes = childNodes as any;

  defaultsClone.id = base.id;
  defaultsClone.type = base.type;
  if (base.position) defaultsClone.position = cloneValue(base.position);
  defaults.set(base.id!, defaultsClone);

  return base as GraphNode;
}

export async function inflateGraph(rawGraph: any, loadTemplate: LoadTemplateFn): Promise<{ graph: Graph; defaults: TemplateById }> {
  const wrapper = rawGraph && typeof rawGraph === "object" && Array.isArray(rawGraph.nodes)
    ? rawGraph
    : { type: "", name: rawGraph?.name, nodes: Array.isArray(rawGraph?.nodes) ? rawGraph.nodes : [rawGraph] };

  const defaults: TemplateById = new Map();
  const graph: Graph = {
    id: typeof wrapper.id === "number" ? wrapper.id : 0,
    type: typeof wrapper.type === "string" ? wrapper.type : "",
    name: typeof wrapper.name === "string" ? wrapper.name : undefined,
    meta: Array.isArray(wrapper.meta) ? cloneValue(wrapper.meta) : [],
    position: Array.isArray(wrapper.position) ? cloneValue(wrapper.position) : undefined,
    nodes: [],
    inputs: [],
    outputs: [],
    properties: [],
  } as any;

  const children = Array.isArray(wrapper.nodes) ? wrapper.nodes : [];
  for (const child of children) {
    const inflated = await inflateNode(child, loadTemplate, defaults);
    graph.nodes!.push(inflated);
  }

  return { graph, defaults };
}

