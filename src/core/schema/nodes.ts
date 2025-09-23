import type { NodePalette, NodeTemplate } from "./types";

export async function fetchNodePalette(signal?: AbortSignal): Promise<NodePalette> {
  // Try dynamic API (dev/server), then static index (Cloudflare Pages)
  let data: NodePalette | null = null;
  try {
    const res = await fetch("/api/nodes", signal ? { signal } : undefined);
    if (res.ok) {
      data = (await res.json()) as NodePalette;
    }
  } catch {}
  if (!data) {
    const res2 = await fetch("/data/nodes.index.json", signal ? { signal } : undefined);
    if (!res2.ok) throw new Error(`Failed to load nodes: ${res2.status}`);
    data = (await res2.json()) as NodePalette;
  }
  // Ensure minimal shape
  return {
    categories: Array.isArray(data.categories) ? data.categories : [],
    flat: Array.isArray(data.flat) ? data.flat : [],
  };
}

export async function fetchNodeTemplate(path: string, signal?: AbortSignal): Promise<NodeTemplate> {
  // Try server API, fallback to static JSON under /data/nodes/<path>
  try {
    const u = new URL("/api/node-template", location.origin);
    u.searchParams.set("path", path);
    const res = await fetch(u.toString(), signal ? { signal } : undefined);
    if (res.ok) return (await res.json()) as NodeTemplate;
  } catch {}
  const staticUrl = new URL(`/data/nodes/${path}`, location.origin);
  const res2 = await fetch(staticUrl.toString(), signal ? { signal } : undefined);
  if (!res2.ok) throw new Error(`Failed to load node template: ${res2.status}`);
  return (await res2.json()) as NodeTemplate;
}
