import type { Node } from "@xyflow/react";
import type { NodePaletteItem, NodeTemplate } from "../schema/nodes";

export function buildRFNodeFromTemplate(opts: {
  id: string;
  item: NodePaletteItem;
  template?: NodeTemplate;
  position: { x: number; y: number };
  parentId?: string;
  nodeDefaults?: Partial<Node>;
}): Node {
  const { id, item, template, position, parentId, nodeDefaults } = opts;
  const graphNode: NodeTemplate = template
    ? {
        ...template,
        id: Number(id),
        position: [Math.round(position.x), Math.round(position.y)],
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
      };

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
  if (parentId) base.parentId = parentId;
  return base as Node;
}

