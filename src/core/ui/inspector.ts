export type InspectorNodeLike = {
  id: string;
  data?: {
    template?: {
      meta?: unknown;
    };
  };
};

function isEditorNode(node: InspectorNodeLike | undefined | null): boolean {
  if (!node) return false;
  const meta = node.data?.template?.meta;
  if (!Array.isArray(meta)) return false;
  return meta.includes("editor_node");
}

export function resolveInspectorNodeId({
  previous,
  selectedNodes,
  nodesById,
}: {
  previous: string | null | undefined;
  selectedNodes: InspectorNodeLike[];
  nodesById: ReadonlyMap<string, InspectorNodeLike>;
}): string | null {
  const firstInspectable = selectedNodes.find((node) => !isEditorNode(node));
  if (firstInspectable) {
    return firstInspectable.id;
  }

  if (selectedNodes.length === 0) {
    return null;
  }

  if (previous) {
    const existing = nodesById.get(previous);
    if (existing && !isEditorNode(existing)) {
      return previous;
    }
  }

  return null;
}
