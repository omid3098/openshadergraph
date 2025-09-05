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

export type NodeTemplate = {
  id?: number;
  type: string;
  name?: string;
  meta?: any[];
  position?: [number, number];
  nodes?: any[];
  inputs?: Array<{ id?: number; name: string; type: any; value?: any }>;
  outputs?: Array<{ id?: number; name: string; type: any }>;
};

export async function fetchNodeTemplate(path: string, signal?: AbortSignal): Promise<NodeTemplate> {
  const u = new URL("/api/node-template", location.origin);
  u.searchParams.set("path", path);
  const res = await fetch(u.toString(), { signal });
  if (!res.ok) throw new Error(`Failed to load node template: ${res.status}`);
  const data = (await res.json()) as NodeTemplate;
  return data;
}
