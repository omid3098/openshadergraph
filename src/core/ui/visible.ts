/**
 * Returns nodes visible under a current parent, stripping parentId when the parent
 * node is not included in the resulting list to avoid ReactFlow warnings.
 */
export function prepareVisibleNodes<T extends { id: string; parentId?: string }>(
  nodes: Array<T>,
  currentParentId?: string
): Array<T> {
  const filtered = nodes.filter((n) => (n.parentId ?? undefined) === (currentParentId ?? undefined));
  const visibleIds = new Set(filtered.map((n) => n.id));
  return filtered.map((n) => {
    if (n.parentId && !visibleIds.has(n.parentId)) {
      const copy: any = { ...n };
      delete copy.parentId;
      return copy as T;
    }
    return n;
  });
}
