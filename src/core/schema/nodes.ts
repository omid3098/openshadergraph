export type NodePaletteItem = {
  type: string;
  name: string;
  path: string; // relative to data/nodes
  category: string; // top-level folder name or 'root'
};

export type NodePalette = {
  categories: Array<{ name: string; nodes: NodePaletteItem[] }>;
  flat: NodePaletteItem[];
};

export async function fetchNodePalette(signal?: AbortSignal): Promise<NodePalette> {
  const res = await fetch("/api/nodes", { signal });
  if (!res.ok) throw new Error(`Failed to load nodes: ${res.status}`);
  const data = (await res.json()) as NodePalette;
  // Ensure minimal shape
  return {
    categories: Array.isArray(data.categories) ? data.categories : [],
    flat: Array.isArray(data.flat) ? data.flat : [],
  };
}

