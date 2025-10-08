import type { AssetItem, AssetLibrary } from "./types";
import { validateAssetLibrary } from "./validators";

export type FetchAssetLibraryOptions = {
  signal?: AbortSignal;
  providers?: string[];
};

export async function fetchAssetLibrary(options?: FetchAssetLibraryOptions): Promise<AssetLibrary> {
  const signal = options?.signal;
  const rawProviders = Array.isArray(options?.providers) ? options.providers : [];
  const providers = rawProviders
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter((id) => id.length > 0);
  const params = new URLSearchParams();
  for (const provider of providers) {
    params.append("provider", provider);
  }
  const query = params.toString();
  const res = await fetch(`/api/assets${query ? `?${query}` : ""}`, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`Failed to load asset library: ${res.status}`);
  const data = await res.json();
  return validateAssetLibrary(data);
}

export type FetchAmbientcgCatalogOptions = {
  signal?: AbortSignal;
  cursor?: string | null;
  query?: string;
  type?: "texture" | "model" | "all";
};

export type AmbientcgCatalogResponse = {
  items: AssetItem[];
  cursor: string | null;
};

export async function fetchAmbientcgCatalog(options?: FetchAmbientcgCatalogOptions): Promise<AmbientcgCatalogResponse> {
  const signal = options?.signal;
  const params = new URLSearchParams();
  if (options?.cursor) {
    params.set("cursor", options.cursor);
  }
  if (options?.query) {
    params.set("query", options.query);
  }
  if (options?.type) {
    params.set("type", options.type);
  }
  const query = params.toString();
  const res = await fetch(`/api/assets/ambientcg/catalog${query ? `?${query}` : ""}`, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`Failed to load ambientCG catalog: ${res.status}`);
  const data = await res.json();
  const cursor = typeof data?.cursor === "string" && data.cursor.length ? data.cursor : null;
  const items = Array.isArray(data?.items)
    ? data.items
        .filter((item: any): item is AssetItem => {
          return item && typeof item.id === "string" && typeof item.label === "string" && typeof item.source === "string";
        })
        .map((item: AssetItem) => ({ ...item, builtin: item.builtin !== false } as AssetItem))
    : [];
  return { items, cursor };
}
