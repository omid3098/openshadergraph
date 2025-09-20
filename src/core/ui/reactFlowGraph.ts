import type { Edge, Node, XYPosition } from "@xyflow/react";
import type { GraphNode } from "@/core/graph/types";
import type { NodeProperty, NodeTemplate } from "@/core/schema/types";
import { parseEditorSize } from "./nodeFactory";

export type AssetEntry = {
  id: string;
  source: string;
  label?: string;
  type?: string;
  builtin?: boolean;
};

export type AssetRegistry = {
  byId: Map<string, AssetEntry>;
  bySource: Map<string, AssetEntry>;
};

export type BuildReactFlowGraphOptions = {
  layout?: {
    depthX?: number;
    rowY?: number;
    baseX?: number;
    baseY?: number;
  };
  nodeDefaults?: Partial<Node>;
};

export type BuildReactFlowGraphContext = {
  root: GraphNode;
  defaults?: Map<number, NodeTemplate>;
  assets?: AssetRegistry;
  options?: BuildReactFlowGraphOptions;
};

export type BuildReactFlowGraphResult = {
  nodes: Node[];
  edges: Edge[];
  maxId: number;
  defaultViewPath: string[];
  rootId: string;
};

const REF_RE = /^\.\.\/(\d+)\/(\d+)$/;

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item)) as unknown as T;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([key]) => key !== "parent");
    return Object.fromEntries(entries.map(([key, val]) => [key, cloneValue(val)])) as T;
  }
  return value;
}

function normalizePosition(position: [number, number] | undefined, fallback: XYPosition): XYPosition {
  if (Array.isArray(position) && position.length === 2) {
    const [x, y] = position;
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  return fallback;
}

function filterMeta(meta: any[] | undefined): string[] {
  if (!Array.isArray(meta)) return [];
  return meta.filter((entry) => {
    if (typeof entry !== "string") return true;
    if (entry.startsWith("asset:")) return false;
    if (entry.startsWith("shading_")) return false;
    return true;
  }) as string[];
}

function resolveAssetFromMeta(meta: any[] | undefined): string | undefined {
  if (!Array.isArray(meta)) return undefined;
  for (const entry of meta) {
    if (typeof entry !== "string") continue;
    if (entry.startsWith("asset:")) {
      const token = entry.slice("asset:".length).trim();
      if (token) return token;
    }
  }
  return undefined;
}

function normalizeAssetLabel(entry: AssetEntry | undefined, properties: NodeProperty[] | undefined): string | undefined {
  if (!entry) return undefined;
  const prop = properties?.find((p) => p && typeof p === "object" && p.id === "model_label");
  const value = (prop as any)?.value;
  if (typeof value === "string" && value.trim().length) return value.trim();
  return entry.label ?? entry.id;
}

function applyAssetToProperties(
  properties: NodeProperty[] | undefined,
  asset: AssetEntry | undefined,
  assetPropIds: Set<string>
): NodeProperty[] | undefined {
  if (!asset) return properties;
  const next: NodeProperty[] = Array.isArray(properties) ? properties.map((prop) => cloneValue(prop)) : [];
  let assigned = false;
  for (let i = 0; i < next.length; i++) {
    const prop = next[i];
    if (!prop || typeof prop !== "object" || typeof prop.id !== "string") continue;
    if (!assetPropIds.has(prop.id)) continue;
    (next[i] as any).value = asset.source;
    assigned = true;
  }
  if (!assigned) {
    const fallbackPropId = asset.type === "model" ? "model_source" : "source";
    const fallbackLabel = fallbackPropId === "model_source" ? "Model Asset" : "Texture Asset";
    next.push({
      id: fallbackPropId,
      type: "asset",
      assetKind: asset.type === "model" ? "model" : "texture",
      label: fallbackLabel,
      value: asset.source,
    } as any);
  }
  return next;
}

function collectAssetCandidates(properties: NodeProperty[] | undefined, assetPropIds: Set<string>) {
  const indices: number[] = [];
  const tokens = new Set<string>();
  if (!Array.isArray(properties)) return { indices, tokens };
  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];
    if (!prop || typeof prop !== "object" || typeof prop.id !== "string") continue;
    if (!assetPropIds.has(prop.id)) continue;
    indices.push(i);
    const value = (prop as any).value;
    if (typeof value === "string" && value.startsWith("asset:")) {
      const token = value.slice("asset:".length).trim();
      if (token) tokens.add(token);
    }
  }
  return { indices, tokens };
}

function registerShadingProperty(properties: NodeProperty[] | undefined, meta: any[] | undefined) {
  if (!Array.isArray(meta)) return properties;
  const shadingMeta = meta.find((entry) => typeof entry === "string" && entry.startsWith("shading_"));
  if (!shadingMeta) return properties;
  const slug = shadingMeta.slice("shading_".length).trim();
  const map: Record<string, string> = { pbr: "pbr", unlit: "unlit", toon: "toon" };
  const value = map[slug];
  if (!value) return properties;

  const next: NodeProperty[] = Array.isArray(properties) ? properties.map((prop) => cloneValue(prop)) : [];
  let assigned = false;
  for (let i = 0; i < next.length; i++) {
    const prop = next[i];
    if (!prop || typeof prop !== "object" || prop.id !== "shading_model") continue;
    (next[i] as any).value = value;
    assigned = true;
    break;
  }
  if (!assigned) {
    next.push({ id: "shading_model", type: "enum", value } as any);
  }
  return next;
}

export function buildReactFlowGraph({ root, defaults, assets, options }: BuildReactFlowGraphContext): BuildReactFlowGraphResult {
  const layout = {
    depthX: options?.layout?.depthX ?? 240,
    rowY: options?.layout?.rowY ?? 120,
    baseX: options?.layout?.baseX ?? 80,
    baseY: options?.layout?.baseY ?? 40,
  };

  const createdNodes: Node[] = [];
  const createdEdges: Edge[] = [];
  const perParentRow = new Map<string, number>();
  const allNodes = new Map<number, GraphNode>();
  const rootId = String(root.id);

  const assetPropIds = new Set(["source", "texture_source", "model_source"]);

  const walk = (node: GraphNode, parentId?: string, depth = 0) => {
    const id = Number(node.id);
    allNodes.set(id, node);
    const key = parentId ?? "root";
    const row = perParentRow.get(key) ?? 0;
    const fallbackPos: XYPosition = {
      x: layout.baseX + depth * layout.depthX,
      y: layout.baseY + row * layout.rowY,
    };
    perParentRow.set(key, row + 1);

    const rawMeta = Array.isArray(node.meta) ? node.meta : [];
    const filteredMeta = filterMeta(rawMeta);
    const dimensions = parseEditorSize(filteredMeta as string[]);

    const defaultsForNode = defaults?.get(id);
    const propertiesOriginal = Array.isArray(node.properties)
      ? (node.properties as NodeProperty[])
      : (defaultsForNode?.properties as NodeProperty[] | undefined);
    let properties = propertiesOriginal ? cloneValue(propertiesOriginal) : [];

    let asset: AssetEntry | undefined;
    const metaToken = resolveAssetFromMeta(rawMeta);
    if (metaToken && assets?.byId.has(metaToken)) {
      asset = assets?.byId.get(metaToken);
    }

    const { indices: assetPropertyIndices, tokens: propertyTokens } = collectAssetCandidates(propertiesOriginal, assetPropIds);
    if (!asset && assets) {
      for (const token of propertyTokens) {
        const entry = assets.byId.get(token);
        if (entry) {
          asset = entry;
          break;
        }
      }
    }
    if (!asset && assets && Array.isArray(propertiesOriginal)) {
      for (const index of assetPropertyIndices) {
        const value = (propertiesOriginal[index] as any)?.value;
        if (typeof value !== "string") continue;
        const entry = assets.bySource.get(value.trim());
        if (entry) {
          asset = entry;
          break;
        }
      }
    }

    if (asset) {
      properties = applyAssetToProperties(properties, asset, assetPropIds) ?? properties;
      const labelOverride = normalizeAssetLabel(asset, properties);
      if (labelOverride) {
        for (let i = 0; i < properties.length; i++) {
          const prop = properties[i];
          if (!prop || typeof prop !== "object" || prop.id !== "model_label") continue;
          (properties[i] as any).value = labelOverride;
        }
      }
    }

    properties = registerShadingProperty(properties, rawMeta) ?? properties;

    const nodePayload: Node = {
      id: String(id),
      type: "graphNode",
      position: normalizePosition(node.position as [number, number] | undefined, fallbackPos),
      ...(options?.nodeDefaults ?? {}),
      data: {
        label: node.name ?? node.type,
        type: node.type,
        template: {
          id,
          type: node.type,
          name: node.name,
          meta: filteredMeta,
          position: node.position ? cloneValue(node.position) : [fallbackPos.x, fallbackPos.y],
          nodes: cloneValue(node.nodes ?? []),
          inputs: cloneValue(node.inputs ?? []),
          outputs: cloneValue(node.outputs ?? []),
          properties,
        },
        ...(defaultsForNode
          ? {
              templateDefaults: (() => {
                const clone = cloneValue(defaultsForNode);
                clone.id = id;
                if (node.position) clone.position = cloneValue(node.position);
                return clone;
              })(),
            }
          : {}),
        ...(asset
          ? {
              asset: {
                id: asset.id,
                source: asset.source,
                label: normalizeAssetLabel(asset, properties),
                type: asset.type,
                builtin: asset.builtin,
              },
            }
          : {}),
      },
      ...(parentId ? { parentId } : {}),
    };

    if (Number.isFinite(dimensions.width) || Number.isFinite(dimensions.height)) {
      nodePayload.style = {
        ...(Number.isFinite(dimensions.width) ? { width: dimensions.width } : {}),
        ...(Number.isFinite(dimensions.height) ? { height: dimensions.height } : {}),
      };
    }

    createdNodes.push(nodePayload);
    for (const child of node.nodes ?? []) {
      walk(child, String(id), depth + 1);
    }
  };

  walk(root, undefined, 0);

  for (const node of allNodes.values()) {
    for (const pin of node.inputs ?? []) {
      if (typeof pin.value !== "string") continue;
      const match = pin.value.match(REF_RE);
      if (!match) continue;
      const fromId = match[1];
      const fromPin = Number(match[2]);
      createdEdges.push({
        id: `e${fromId}-${node.id}-${fromPin}-${pin.id}`,
        source: String(fromId),
        target: String(node.id),
        sourceHandle: `out-${fromPin}`,
        targetHandle: `in-${pin.id}`,
      });
    }
  }

  const maxId = Math.max(...Array.from(allNodes.keys())) || Number(root.id) || 0;

  const fragmentPass = (root.nodes ?? []).find((child) => child.type === "fragment_pass");
  const vertexPass = (root.nodes ?? []).find((child) => child.type === "vertex_pass");
  const defaultViewPath = fragmentPass
    ? [rootId, String(fragmentPass.id)]
    : vertexPass
      ? [rootId, String(vertexPass.id)]
      : [rootId];

  return {
    nodes: createdNodes,
    edges: createdEdges,
    maxId,
    defaultViewPath,
    rootId,
  };
}
