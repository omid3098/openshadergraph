export type DockItemDescriptor = { id: "properties" | "compile" | "graphdata" | "preview"; name: string };

export function buildDockItemDescriptors(opts: { includePreview?: boolean; includeCompile?: boolean; includeGraphData?: boolean; includeProperties?: boolean }) {
  const { includePreview: includePreview = true, includeCompile = true, includeGraphData = true, includeProperties = true } = opts ?? ({} as any);
  const items: DockItemDescriptor[] = [];
  if (includeProperties) items.push({ id: "properties", name: "Properties" });
  if (includeCompile) items.push({ id: "compile", name: "Compile" });
  if (includeGraphData) items.push({ id: "graphdata", name: "Graph Data" });
  if (includePreview) items.push({ id: "preview", name: "Preview" });
  return items;
}
