import type { Node } from "@xyflow/react";
import type { NodePaletteItem, NodeTemplate } from "../schema/types";

export function parseEditorSize(meta: string[] | undefined): { width?: number; height?: number } {
  if (!meta) return {};
  const entry = meta.find((m) => typeof m === "string" && m.startsWith("editor_size:"));
  if (!entry) return {};
  const [, size] = entry.split(":", 2);
  if (!size) return {};
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return {};
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return {};
  return { width, height };
}

export function buildRFNodeFromTemplate(opts: {
  id: string;
  item: NodePaletteItem;
  template?: NodeTemplate;
  position: { x: number; y: number };
  parentId?: string;
  nodeDefaults?: Partial<Node>;
}): Node {
  const { id, item, template, position, parentId, nodeDefaults } = opts;
  const graphNode: any = template
    ? {
        ...template,
        id: Number(id),
        position: [Math.round(position.x), Math.round(position.y)],
        meta: Array.isArray(template.meta) ? ([...template.meta] as string[]) : [],
        properties: Array.isArray(template.properties)
          ? (template.properties.map((prop: any) =>
              prop && typeof prop === "object"
                ? ({ ...prop, value: prop.value !== undefined ? prop.value : prop.default } as any)
                : prop
            ) as any[])
          : ([] as any[]),
      }
    : {
        id: Number(id),
        type: item.type,
        name: item.name,
        meta: [],
        position: [Math.round(position.x), Math.round(position.y)],
        nodes: [],
        inputs: [],
        outputs: [],
        properties: [],
      };

  if (!Array.isArray(graphNode.meta)) graphNode.meta = [];

  const base: any = {
    id,
    type: "graphNode",
    position,
    data: {
      label: graphNode.name ?? item.name,
      type: graphNode.type,
      templatePath: item.path,
      category: item.category,
      template: graphNode,
    },
    ...(nodeDefaults ?? {}),
  };

  const meta = Array.isArray(graphNode.meta) ? graphNode.meta : [];
  const isEditor = meta.includes("editor_node");
  if (isEditor) {
    const { width, height } = parseEditorSize(meta);
    if (width || height) {
      base.style = {
        ...(base.style ?? {}),
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
      } as any;
    }
  }
  if (parentId) base.parentId = parentId;
  return base as Node;
}
