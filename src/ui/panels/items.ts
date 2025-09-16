export type DockItemDescriptor = { id: "properties" | "compile" | "graphdata" | "assets" | "preview"; name: string };

export function buildDockItemDescriptors(opts: { includePreview?: boolean; includeCompile?: boolean; includeGraphData?: boolean; includeAssets?: boolean; includeProperties?: boolean }) {
  const {
    includePreview: includePreview = true,
    includeCompile = true,
    includeGraphData = true,
    includeAssets = true,
    includeProperties = true,
  } = opts ?? ({} as any);
  const items: DockItemDescriptor[] = [];
  if (includeProperties) items.push({ id: "properties", name: "Properties" });
  if (includeCompile) items.push({ id: "compile", name: "Compile" });
  if (includeGraphData) items.push({ id: "graphdata", name: "Graph Data" });
  if (includeAssets) items.push({ id: "assets", name: "Assets" });
  if (includePreview) items.push({ id: "preview", name: "Preview" });
  return items;
}
