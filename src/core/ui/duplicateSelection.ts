import type { Edge, Node } from "@xyflow/react";
import type { DuplicateNodesResult } from "@/core/graph/duplicate";

export type ApplyDuplicateSelectionParams = {
  nodes: Node[];
  edges: Edge[];
  selectedIds: Set<string>;
  duplicate: DuplicateNodesResult;
};

export type ApplyDuplicateSelectionResult = {
  nodes: Node[];
  edges: Edge[];
};

export function applyDuplicateSelection({ nodes, edges, selectedIds, duplicate }: ApplyDuplicateSelectionParams): ApplyDuplicateSelectionResult {
  if (!duplicate.nodesToAdd.length) {
    return { nodes, edges };
  }

  const deselected = nodes.map((node) => {
    if (!selectedIds.has(node.id)) return node;
    return { ...node, selected: false } as Node;
  });

  const additions = duplicate.nodesToAdd.map((node) => ({
    ...node,
    selected: true,
  })) as Node[];

  const nextNodes = [...deselected, ...additions];
  const nextEdges = [...edges, ...duplicate.edgesToAdd];

  return {
    nodes: nextNodes,
    edges: nextEdges,
  };
}

