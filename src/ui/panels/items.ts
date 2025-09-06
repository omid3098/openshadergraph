export type DockItemDescriptor = { id: "preview" | "compile" | "graphdata"; name: string };

export function buildDockItemDescriptors(opts: { includePreview?: boolean; includeCompile?: boolean; includeGraphData?: boolean }) {
  const { includePreview = true, includeCompile = true, includeGraphData = true } = opts ?? {} as any;
  const items: DockItemDescriptor[] = [];
  if (includePreview) items.push({ id: "preview", name: "Preview" });
  if (includeCompile) items.push({ id: "compile", name: "Compile Output" });
  if (includeGraphData) items.push({ id: "graphdata", name: "Graph Data" });
  return items;
}

