export type DockItemDescriptor = { id: "editor" | "properties" | "compile" | "graphdata" | "preview"; name: string };

export function buildDockItemDescriptors(opts: { includeEditor?: boolean; includePreview?: boolean; includeCompile?: boolean; includeGraphData?: boolean; includeProperties?: boolean }) {
  const { includeEditor: includeEditor = true, includePreview: includePreview = true, includeCompile = true, includeGraphData = true, includeProperties = true } = opts ?? ({} as any);
  const items: DockItemDescriptor[] = [];
  if (includeEditor) items.push({ id: "editor", name: "Editor" });
  if (includeProperties) items.push({ id: "properties", name: "Properties" });
  if (includeCompile) items.push({ id: "compile", name: "Compile" });
  if (includeGraphData) items.push({ id: "graphdata", name: "Graph Data" });
  if (includePreview) items.push({ id: "preview", name: "Preview" });
  return items;
}
